import { HindsightClient } from '@vectorize-io/hindsight-client';
import { logger } from '../logger.js';
import { getLogger } from '../logger/log-context.js';
import type {
  AgentMemory,
  MemoryEntry,
  RetainOptions,
  RecallOptions,
  ReflectOptions,
  BankConfig,
} from '../../application/ports/agent-memory.port.js';

export interface HindsightAgentMemoryConfig {
  baseUrl: string;
  apiKey?: string;
}

export class HindsightAgentMemory {
  client;
  knownBanks = new Set();
  constructor(config: HindsightAgentMemoryConfig) {
    this.client = new HindsightClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }
  async retain(tenantId: string, content: string, options?: RetainOptions): Promise<void> {
    const bankId = this.toBankId(tenantId);
    const start = Date.now();
    try {
      await this.ensureBank(bankId);
      await this.client.retain(bankId, content, {
        context: options?.context,
        metadata: options?.metadata ? this.toStringRecord(options.metadata) : undefined,
        tags: options?.tags,
        // Sync retain so AC-052 can observe writes via GET .../memories without racing
        // the Hindsight background indexer.
        async: false,
      });
      getLogger().debug(
        { event: 'hindsight.retain', tenantId, durationMs: Date.now() - start },
        'hindsight.retain',
      );
    } catch (err) {
      getLogger().error(
        {
          event: 'hindsight.retain.failed',
          tenantId,
          durationMs: Date.now() - start,
          errorType: (err as Error).name,
        },
        'hindsight.retain.failed',
      );
      logger.warn({ err, tenantId }, 'Failed to retain memory — non-critical');
    }
  }
  async recall(tenantId: string, query: string, options?: RecallOptions): Promise<MemoryEntry[]> {
    const bankId = this.toBankId(tenantId);
    const start = Date.now();
    try {
      const response = await this.client.recall(bankId, query, {
        types: options?.types,
        maxTokens: 4096,
        budget: options?.budget ?? 'mid',
        tags: options?.tags,
        tagsMatch: options?.tagsMatch,
      });
      const result: MemoryEntry[] = response.results
        .slice(0, options?.maxResults ?? 5)
        .map((r) => ({
          text: r.text,
          type: (r.type === 'world' || r.type === 'observation' ? r.type : 'world') as
            | 'world'
            | 'observation',
          score: undefined,
        }));
      getLogger().info(
        {
          event: 'hindsight.recall',
          tenantId,
          durationMs: Date.now() - start,
          resultCount: result.length,
        },
        'hindsight.recall',
      );
      return result;
    } catch (err) {
      getLogger().error(
        {
          event: 'hindsight.recall.failed',
          tenantId,
          durationMs: Date.now() - start,
          errorType: (err as Error).name,
        },
        'hindsight.recall.failed',
      );
      logger.warn({ err, tenantId }, 'Failed to recall memories — returning empty');
      return [];
    }
  }
  async reflect(tenantId: string, query: string, options?: ReflectOptions): Promise<string> {
    const bankId = this.toBankId(tenantId);
    const start = Date.now();
    try {
      const response = await this.client.reflect(bankId, query, {
        budget: options?.budget ?? 'mid',
        context: options?.context,
        tags: options?.tags,
        tagsMatch: options?.tagsMatch,
      });
      getLogger().info(
        { event: 'hindsight.reflect', tenantId, durationMs: Date.now() - start },
        'hindsight.reflect',
      );
      return response.text;
    } catch (err) {
      getLogger().error(
        {
          event: 'hindsight.reflect.failed',
          tenantId,
          durationMs: Date.now() - start,
          errorType: (err as Error).name,
        },
        'hindsight.reflect.failed',
      );
      logger.warn({ err, tenantId }, 'Failed to reflect on memories — returning empty');
      return '';
    }
  }
  async configureBank(tenantId: string, config: BankConfig): Promise<void> {
    const bankId = this.toBankId(tenantId);
    const start = Date.now();
    try {
      // Create bank first (idempotent — ignores if already exists)
      await this.client.createBank(bankId);
      this.knownBanks.add(bankId);
      // Apply full configuration via updateBankConfig (createBank's fields are deprecated)
      await this.client.updateBankConfig(bankId, {
        reflectMission: config.reflectMission,
        retainMission: config.retainMission,
        observationsMission: config.observationsMission,
        enableObservations: true,
        dispositionSkepticism: config.disposition.skepticism,
        dispositionLiteralism: config.disposition.literalism,
        dispositionEmpathy: config.disposition.empathy,
      });
      if (config.directives) {
        for (const directive of config.directives) {
          await this.client.createDirective(bankId, directive.name, directive.content, {
            priority: directive.priority,
          });
        }
      }
      getLogger().info(
        { event: 'hindsight.configureBank', tenantId, durationMs: Date.now() - start },
        'hindsight.configureBank',
      );
      logger.info({ tenantId, bankId }, 'Hindsight bank configured');
    } catch (err) {
      getLogger().error(
        {
          event: 'hindsight.configureBank.failed',
          tenantId,
          durationMs: Date.now() - start,
          errorType: (err as Error).name,
        },
        'hindsight.configureBank.failed',
      );
      logger.warn({ err, tenantId }, 'Failed to configure Hindsight bank — non-critical');
    }
  }
  toBankId(tenantId: string) {
    return `causeflow-${tenantId}`;
  }
  async ensureBank(bankId: string) {
    if (this.knownBanks.has(bankId)) return;
    try {
      await this.client.createBank(bankId, {
        reflectMission: `You are the memory system for an AI SRE platform. You store and recall facts about infrastructure incidents, root causes, remediation actions, and service behavior patterns. Your goal is to help investigation agents learn from past incidents and make faster, more accurate diagnoses.`,
      });
    } catch {
      // Bank may already exist — that's fine
    }
    this.knownBanks.add(bankId);
  }
  toStringRecord(obj: Record<string, unknown>) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = String(v);
    }
    return result;
  }
}
