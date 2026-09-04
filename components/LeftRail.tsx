'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';

interface LeftRailProps {
  rooms: LiveRoom[];
  onSelectRoom: (room: LiveRoom) => void;
}

export function LeftRail({ rooms, onSelectRoom }: LeftRailProps) {
  return (
    <aside
      className="fixed left-0 bottom-0 overflow-y-auto"
      style={{
        top: '48px',
        width: '190px',
        backgroundColor: 'var(--elevated)',
        borderRight: '1px solid var(--border)'
      }}
    >
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Live Channels
        </h2>
      </div>

      <div className="py-2">
        {rooms.slice(0, 10).map((room) => (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--surface)] transition-colors"
          >
            {/* Avatar placeholder */}
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white'
              }}
            >
              {room.host.slice(2, 4).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {room.hostDisplayName || `${room.host.slice(0, 6)}...${room.host.slice(-4)}`}
                </p>
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{
                    backgroundColor: 'var(--live)',
                    color: 'white'
                  }}
                >
                  LIVE
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                {room.category}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {room.viewers.toLocaleString()} viewers
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Demo badge */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--elevated)' }}>
        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          Demo rooms for hackathon
        </p>
      </div>
    </aside>
  );
}
