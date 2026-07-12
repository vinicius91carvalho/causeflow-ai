import { AsyncLocalStorage } from 'node:async_hooks';
import Langfuse from 'langfuse';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import type {
  Tracer,
  Span,
  SpanAttributes,
  TraceContext,
  SpanType,
  LLMUsage,
} from '../../application/ports/tracer.port.js';

/**
 * Internal entry stored in the async-local-storage stack.
 * - trace: the Langfuse root trace object (shared by all spans in the tree)
 * - span: the current observation (span or generation) — children are created off this
 */
interface ActiveSpanEntry {
  trace: any;
  span: any;
}

/**
 * AsyncLocalStorage that tracks the active span stack per async context.
 * When `startSpan` is called inside an existing span, the new span is
 * created as a child observation instead of a new root trace.
 */
const activeSpanStorage = new AsyncLocalStorage<ActiveSpanEntry[]>();

function getOrCreateSpanStore(): ActiveSpanEntry[] {
  let store = activeSpanStorage.getStore();
  if (!store) {
    store = [];
    activeSpanStorage.enterWith(store);
  }
  return store;
}

class LangfuseSpan implements Span {
  private trace: any;
  private observation: any;
  private entry: ActiveSpanEntry;

  constructor(trace: any, observation: any, entry: ActiveSpanEntry) {
    this.trace = trace;
    this.observation = observation;
    this.entry = entry;
  }

  setAttribute(key: string, value: string | number | boolean) {
    this.observation.update({ metadata: { [key]: value } });
  }

  setInput(input: unknown) {
    this.observation.update({ input });
    this.trace.update({ input });
  }

  setOutput(output: unknown) {
    this.observation.update({ output });
    this.trace.update({ output });
  }

  setUsage(usage: LLMUsage) {
    this.observation.update({
      model: usage.model,
      usage: {
        input: usage.inputTokens,
        output: usage.outputTokens,
      },
      ...(usage.totalCostUsd != null && { calculatedTotalCost: usage.totalCostUsd }),
    });
  }

  setStatus(status: 'ok' | 'error', message?: string) {
    this.observation.update({
      level: status === 'error' ? 'ERROR' : 'DEFAULT',
      statusMessage: message,
    });
  }

  end() {
    // Remove this entry from the active stack so that sibling/child spans
    // created afterwards don't inadvertently attach to an ended span.
    const store = activeSpanStorage.getStore();
    if (store) {
      const idx = store.indexOf(this.entry);
      if (idx !== -1) {
        store.splice(idx, 1);
      }
    }
    this.observation.end();
  }
}

export class LangfuseTracer implements Tracer {
  client: Langfuse;

  constructor() {
    this.client = new Langfuse({
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      baseUrl: config.langfuse.baseUrl,
    });
  }

  startSpan(
    name: string,
    attributes?: SpanAttributes,
    context?: TraceContext,
    type: SpanType = 'span',
  ): Span {
    const store = getOrCreateSpanStore();
    const parentEntry = store.length > 0 ? store[store.length - 1] : null;

    let trace: any;
    let observation: any;

    if (parentEntry) {
      // ── Child span under the active parent ──
      // The parent entry's span may itself be a child (nested); Langfuse
      // supports arbitrary nesting via observation.span() / .generation().
      trace = parentEntry.trace;
      const parent = parentEntry.span;
      observation =
        type === 'generation'
          ? parent.generation({ name, metadata: attributes })
          : parent.span({ name, metadata: attributes });
    } else {
      // ── Root trace (no active parent) ──
      trace = this.client.trace({
        name,
        metadata: attributes,
        ...(context?.sessionId && { sessionId: context.sessionId }),
        ...(context?.userId && { userId: context.userId }),
        // Propagate tenant/incident identifiers as Langfuse tags so they are
        // filterable in the Langfuse UI (AC-018).
        tags: attributes
          ? Object.entries(attributes)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => `${k}:${v}`)
          : [],
      });
      observation =
        type === 'generation'
          ? trace.generation({ name, metadata: attributes })
          : trace.span({ name, metadata: attributes });
    }

    const entry: ActiveSpanEntry = { trace, span: observation };
    store.push(entry);

    return new LangfuseSpan(trace, observation, entry);
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushAsync();
    } catch (err) {
      logger.warn({ err }, 'Failed to flush Langfuse traces');
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.client.shutdownAsync();
    } catch (err) {
      logger.warn({ err }, 'Failed to shutdown Langfuse');
    }
  }
}
