'use client';

export function LiveBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="live-indicator" aria-label="Live">
      {!compact && <span className="live-dot" aria-hidden />}
      LIVE
    </span>
  );
}

export function MetadataBadge({ children }: { children: React.ReactNode }) {
  return <span className="meta-badge">{children}</span>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag-pill">{children}</span>;
}
