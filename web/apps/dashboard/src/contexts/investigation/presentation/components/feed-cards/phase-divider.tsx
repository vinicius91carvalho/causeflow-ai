export function PhaseDivider({ label, timestamp }: { label: string; timestamp: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
