'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';
import { formatViewerCount, hostInitials, truncateAddress } from '@/lib/utils/asset';
import { Avatar } from './Avatar';

interface SidebarItemProps {
  room: LiveRoom;
  collapsed?: boolean;
  onSelect: (room: LiveRoom) => void;
}

export function SidebarItem({ room, collapsed = false, onSelect }: SidebarItemProps) {
  const label = room.hostDisplayName || truncateAddress(room.host);
  const tip = `${label} · ${room.category} · ${formatViewerCount(room.viewers)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={collapsed ? 'has-tooltip' : undefined}
      data-tooltip={collapsed ? tip : undefined}
      data-tooltip-side={collapsed ? 'right' : undefined}
      aria-label={tip}
      style={{
        width: '100%',
        height: collapsed ? 44 : 42,
        padding: collapsed ? '0' : '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: 'inherit',
        transition: 'background-color var(--duration-fast) ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <Avatar initials={hostInitials(room.host, room.hostDisplayName)} size={30} live={room.isLive} />
      {!collapsed && (
        <>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <p className="truncate-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {label}
            </p>
            <p className="truncate-1" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {room.category}
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {formatViewerCount(room.viewers)}
          </span>
        </>
      )}
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}

export function SidebarSection({ title, collapsed, children }: SidebarSectionProps) {
  return (
    <section style={{ paddingBottom: 8 }}>
      {!collapsed && (
        <div style={{ padding: '10px 12px 6px' }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
