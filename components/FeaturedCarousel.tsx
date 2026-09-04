'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';

interface FeaturedCarouselProps {
  room: LiveRoom;
  onJoin: (room: LiveRoom) => void;
}

export function FeaturedCarousel({ room, onJoin }: FeaturedCarouselProps) {
  return (
    <div className="w-full mb-8">
      <div className="featured-grid" style={{ display: 'grid', gap: '16px' }}>
        {/* Player */}
        <div>
          <div
            className="relative rounded-lg overflow-hidden"
            style={{
              aspectRatio: '16/9',
              backgroundColor: 'var(--surface)'
            }}
          >
            {/* Video placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--live)' }}
                >
                  <div className="w-0 h-0 ml-1" style={{
                    borderLeft: '16px solid white',
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent'
                  }}></div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Click to view stream preview
                </p>
              </div>
            </div>

            {/* LIVE badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-xs font-bold uppercase"
                style={{
                  backgroundColor: 'var(--live)',
                  color: 'white'
                }}
              >
                LIVE
              </span>
              <span
                className="px-2 py-1 rounded text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: 'white'
                }}
              >
                {room.viewers.toLocaleString()} viewers
              </span>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div>
          <div
            className="h-full rounded-lg p-6 flex flex-col justify-between"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div className="space-y-4">
              {/* Avatar + host */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {room.host.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {room.hostDisplayName || `${room.host.slice(0, 8)}...`}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {room.category}
                  </p>
                </div>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                {room.title}
              </h3>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {room.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--elevated)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => onJoin(room)}
              className="w-full py-3 rounded font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent)';
              }}
            >
              Join Stream
            </button>

            {room.isDemoSeed && (
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Demo room
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
