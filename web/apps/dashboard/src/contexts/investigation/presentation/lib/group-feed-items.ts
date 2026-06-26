import type { FeedItem } from '../../domain/feed-types';
import { parseComposioToolName } from './feed-constants';

export interface SourceGroup {
  key: string;
  label: string;
  iconName: string;
  items: FeedItem[];
}

const SKIP_TYPES = new Set<FeedItem['type']>([
  'progress',
  'phase',
  'capabilities',
  'error',
  'idle',
  'guidance',
  'followup',
  'complete',
  'question',
  'tool_error',
]);

export function groupFeedItemsBySource(feed: FeedItem[]): SourceGroup[] {
  const groups: Record<string, SourceGroup> = {};

  function ensure(key: string, label: string, iconName: string): SourceGroup {
    if (!groups[key]) {
      groups[key] = { key, label, iconName, items: [] };
    }
    return groups[key];
  }

  for (const item of feed) {
    if (SKIP_TYPES.has(item.type)) continue;

    if (item.type === 'evidence') {
      const evType = item.evidenceType;

      if (evType === 'historical_context') {
        ensure('memory', 'Memory', 'Brain').items.push(item);
        continue;
      }

      if (evType === 'agent_reasoning') {
        ensure('agent-reasoning', 'Agent Reasoning', 'Bot').items.push(item);
        continue;
      }

      if (evType === 'log_snippet' || evType === 'metric_snapshot' || evType === 'resource_state') {
        ensure('aws', 'AWS', 'Cloud').items.push(item);
        continue;
      }

      ensure('other', 'Other', 'FileSearch').items.push(item);
      continue;
    }

    if (item.type === 'checkpoint' && item.category != null) {
      ensure('findings', 'Findings', 'AlertTriangle').items.push(item);
      continue;
    }

    if (item.type === 'tool_call') {
      const tn = item.toolName ?? '';
      if (tn === 'aws_api_call') {
        ensure('aws', 'AWS', 'Cloud').items.push(item);
      } else if (tn === 'recall_past_incidents' || tn === 'reflect_on_knowledge') {
        ensure('memory', 'Memory', 'Brain').items.push(item);
      } else if (tn.startsWith('composio_')) {
        const parsed = parseComposioToolName(tn);
        if (parsed) {
          ensure(`composio-${parsed.provider}`, parsed.displayName, 'FileSearch').items.push(item);
        }
      } else if (tn === 'report_finding') {
        ensure('findings', 'Findings', 'AlertTriangle').items.push(item);
      } else if (tn) {
        ensure('tools', 'Tools', 'Wrench').items.push(item);
      }
    }
  }

  return Object.values(groups).filter((g) => g.items.length > 0);
}
