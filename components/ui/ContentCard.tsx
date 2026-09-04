'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';
import { assetPath, formatViewerCount, hostInitials, truncateAddress } from '@/lib/utils/asset';
import { Avatar } from './Avatar';
import { LiveBadge, MetadataBadge, Tag } from './Badges';

interface ContentCardProps {
  room: LiveRoom;
  onSelect: (room: LiveRoom) => void;
  variant?: 'browse' | 'manage';
}

export function ContentCard({ room, onSelect, variant = 'browse' }: ContentCardProps) {
  const hostLabel = room.hostDisplayName || truncateAddress(room.host);
  const thumb = room.thumbnail ? assetPath(room.thumbnail) : '';

  return (
    <button
      type="button"
      className="content-card"
      onClick={() => onSelect(room)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
        padding: 0,
      }}
    >
      <div className="thumbnail-wrapper">
        <div className="thumbnail-inner">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'var(--bg-elevated)' }} />
          )}

          {room.isLive && (
            <div style={{ position: 'absolute', top: 8, left: 8 }}>
              <LiveBadge />
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
            <MetadataBadge>
              {variant === 'manage'
                ? room.isLive
                  ? 'Manage'
                  : 'Dashboard'
                : room.isLive
                  ? `${formatViewerCount(room.viewers)} viewers`
                  : 'Ended'}
            </MetadataBadge>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, minWidth: 0 }}>
        <Avatar initials={hostInitials(room.host, room.hostDisplayName)} size={36} live={room.isLive} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            className="content-card-title truncate-2"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.3,
              transition: 'color var(--duration-fast) ease',
            }}
          >
            {room.title}
          </p>
          <p className="truncate-1" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {hostLabel}
          </p>
          <p className="truncate-1" style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {room.category}
          </p>
          {room.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {room.tags.slice(0, 3).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
