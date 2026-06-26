import { context, propagation, trace, type Context } from '@opentelemetry/api';
import type { MessageAttributeValue } from '@aws-sdk/client-sqs';

interface AttrCarrier {
  [k: string]: string;
}

const setter = {
  set(carrier: AttrCarrier, key: string, value: string) {
    carrier[key] = value;
  },
};

const getter = {
  keys(carrier: AttrCarrier) {
    return Object.keys(carrier);
  },
  get(carrier: AttrCarrier, key: string) {
    return carrier[key];
  },
};

export function injectTraceparent(
  attrs: Record<string, MessageAttributeValue>,
  requestId?: string,
): Record<string, MessageAttributeValue> {
  const carrier: AttrCarrier = {};
  propagation.inject(context.active(), carrier, setter);
  const out = { ...attrs };
  if (carrier['traceparent']) {
    out['traceparent'] = { DataType: 'String', StringValue: carrier['traceparent'] };
  }
  if (carrier['tracestate']) {
    out['tracestate'] = { DataType: 'String', StringValue: carrier['tracestate'] };
  }
  if (requestId) {
    out['requestId'] = { DataType: 'String', StringValue: requestId };
  }
  return out;
}

export function extractTraceparent(
  attrs: Record<string, MessageAttributeValue> | undefined,
): Context {
  if (!attrs) return context.active();
  const carrier: AttrCarrier = {};
  if (attrs['traceparent']?.StringValue) carrier['traceparent'] = attrs['traceparent'].StringValue;
  if (attrs['tracestate']?.StringValue) carrier['tracestate'] = attrs['tracestate'].StringValue;
  return propagation.extract(context.active(), carrier, getter);
}

export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}
