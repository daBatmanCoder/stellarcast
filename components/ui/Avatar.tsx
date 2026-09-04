'use client';

interface AvatarProps {
  initials: string;
  size?: number;
  live?: boolean;
  className?: string;
  alt?: string;
}

export function Avatar({ initials, size = 30, live = false, className = '', alt }: AvatarProps) {
  return (
    <span
      className={`avatar ${className}`.trim()}
      aria-label={alt}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--accent-primary)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, Math.round(size * 0.36)),
        fontWeight: 700,
        flexShrink: 0,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {initials.slice(0, 2)}
      {live && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
            borderRadius: '50%',
            background: 'var(--live)',
            border: '2px solid var(--bg-surface)',
          }}
        />
      )}
    </span>
  );
}
