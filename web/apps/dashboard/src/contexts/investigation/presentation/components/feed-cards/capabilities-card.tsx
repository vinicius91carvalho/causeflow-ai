import { Shield } from 'lucide-react';
import type { FeedItem } from '../../../domain/feed-types';

export function CapabilitiesCard({ item }: { item: FeedItem }) {
  const caps = item.capabilities ?? [];
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 /30 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">Agent Capabilities</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {caps.map((cap) => (
          <span
            key={cap}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary"
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}
