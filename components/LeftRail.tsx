'use client';

import { useEffect, useState } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import { IconButton } from './ui/IconButton';
import { IconCollapse, IconExpand } from './ui/Icons';
import { SidebarItem, SidebarSection } from './ui/SidebarItem';

interface LeftRailProps {
  rooms: LiveRoom[];
  recommended?: LiveRoom[];
  onSelectRoom: (room: LiveRoom) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LeftRail({
  rooms,
  recommended = [],
  onSelectRoom,
  collapsed,
  onToggleCollapse,
}: LeftRailProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const liveRooms = rooms.filter((r) => r.isLive).slice(0, 8);
  const discover = (recommended.length ? recommended : rooms.slice().sort((a, b) => b.viewers - a.viewers)).slice(0, 5);

  return (
    <aside
      className="left-rail-desktop scroll-y"
      aria-label="Channels"
      style={{
        position: 'fixed',
        top: 'var(--nav-height)',
        left: 0,
        bottom: 0,
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        zIndex: 40,
        transition: 'width var(--duration-hover) ease',
        display: mounted ? undefined : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          height: 44,
          padding: collapsed ? 0 : '0 8px 0 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Discover
          </span>
        )}
        <IconButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          tooltip={collapsed ? 'Expand' : 'Collapse'}
          tooltipSide={collapsed ? 'right' : 'top'}
          onClick={onToggleCollapse}
        >
          {collapsed ? <IconExpand size={18} /> : <IconCollapse size={18} />}
        </IconButton>
      </div>

      <SidebarSection title="Live channels" collapsed={collapsed}>
        {liveRooms.map((room) => (
          <SidebarItem key={room.id} room={room} collapsed={collapsed} onSelect={onSelectRoom} />
        ))}
      </SidebarSection>

      <SidebarSection title="Popular" collapsed={collapsed}>
        {discover.map((room) => (
          <SidebarItem key={`rec-${room.id}`} room={room} collapsed={collapsed} onSelect={onSelectRoom} />
        ))}
      </SidebarSection>

      {!collapsed && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: 12,
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            marginTop: 'auto',
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            Demo rooms for hackathon presentation
          </p>
        </div>
      )}
    </aside>
  );
}
