'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';

interface LiveGridProps {
  rooms: LiveRoom[];
  onSelectRoom: (room: LiveRoom) => void;
}

export function LiveGrid({ rooms, onSelectRoom }: LiveGridProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Live Channels
      </h2>

      <div className="live-grid">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className="group text-left transition-transform hover:scale-[1.02]"
          >
            {/* Thumbnail */}
            <div
              className="relative rounded-lg overflow-hidden mb-3"
              style={{
                aspectRatio: '16/9',
                backgroundColor: 'var(--surface)'
              }}
            >
              {/* Thumbnail placeholder with gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, var(--accent) 0%, var(--live) 100%)`,
                  opacity: 0.4
                }}
              ></div>

              {/* LIVE badge */}
              <div className="absolute top-2 left-2">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: 'var(--live)',
                    color: 'white'
                  }}
                >
                  LIVE
                </span>
              </div>

              {/* Viewers chip */}
              <div className="absolute bottom-2 left-2">
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: 'white'
                  }}
                >
                  {room.viewers.toLocaleString()} viewers
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex gap-2">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-white text-sm"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {room.host.slice(2, 4).toUpperCase()}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {room.title}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {room.hostDisplayName || `${room.host.slice(0, 6)}...${room.host.slice(-4)}`}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {room.category}
                </p>
                {room.isDemoSeed && (
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Demo
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <style jsx>{`
        .live-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 1023px) {
          .live-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .live-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
