'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';
import { assetPath, formatViewerCount, hostInitials, truncateAddress } from '@/lib/utils/asset';
import { Avatar } from './ui/Avatar';
import { LiveBadge, MetadataBadge, Tag } from './ui/Badges';
import { Button } from './ui/Button';
import { IconPlay } from './ui/Icons';

interface FeaturedCarouselProps {
  room: LiveRoom;
  onJoin: (room: LiveRoom) => void;
}

export function FeaturedCarousel({ room, onJoin }: FeaturedCarouselProps) {
  const hostLabel = room.hostDisplayName || truncateAddress(room.host);
  const thumb = room.thumbnail ? assetPath(room.thumbnail) : '';

  return (
    <section className="content-shelf" aria-label="Featured stream">
      <div className="featured-layout">
        <button
          type="button"
          onClick={() => onJoin(room)}
          className="content-card"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'inherit',
          }}
        >
          <div className="thumbnail-wrapper">
            <div className="thumbnail-inner" style={{ minHeight: 220 }}>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--bg-elevated)' }} />
              )}

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.28)',
                }}
              >
                <span
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.72)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <IconPlay size={24} />
                </span>
              </div>

              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                {room.isLive && <LiveBadge />}
                <MetadataBadge>{formatViewerCount(room.viewers)} viewers</MetadataBadge>
              </div>
            </div>
          </div>
        </button>

        <aside
          className="surface"
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials={hostInitials(room.host, room.hostDisplayName)} size={40} live={room.isLive} />
            <div style={{ minWidth: 0 }}>
              <p className="truncate-1" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                {hostLabel}
              </p>
              <p className="truncate-1" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {room.category}
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{room.title}</h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {room.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, flex: 1 }}>
            Pay with a stealth address to unlock private livestream access on Sepolia.
          </p>

          <Button variant="primary" fullWidth onClick={() => onJoin(room)}>
            Join Stream
          </Button>
        </aside>
      </div>
    </section>
  );
}
