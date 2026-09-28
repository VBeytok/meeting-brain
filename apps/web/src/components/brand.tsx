// `compact` hides the name below the sm breakpoint, leaving the logo mark.
export function Brand({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">
        MB
      </span>
      <span className={`text-lg font-semibold tracking-tight ${compact ? 'max-sm:sr-only' : ''}`}>
        Meeting Brain
      </span>
    </div>
  );
}
