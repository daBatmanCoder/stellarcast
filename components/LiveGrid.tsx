'use client';

import type { LiveRoom } from '@/lib/data/seed-rooms';
import { ContentCard } from './ui/ContentCard';
import { EmptyState } from './ui/EmptyState';
import { SectionHeader } from './ui/SectionHeader';
import { SkeletonCard } from './ui/SkeletonCard';

interface LiveGridProps {
  rooms: LiveRoom[];
  onSelectRoom: (room: LiveRoom) => void;
  title?: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
}

export function LiveGrid({
  rooms,
  onSelectRoom,
  title = 'Live now',
  loading = false,
  emptyTitle = 'No streams found',
  emptyDescription = 'Try a different search or clear filters.',
  onClearFilters,
}: LiveGridProps) {
  return (
    <section className="content-shelf" aria-label={title}>
      <SectionHeader title={title} />

      {loading ? (
        <div className="content-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={onClearFilters ? 'Clear search' : undefined}
          onAction={onClearFilters}
        />
      ) : (
        <div className="content-grid">
          {rooms.map((room) => (
            <ContentCard key={room.id} room={room} onSelect={onSelectRoom} />
          ))}
        </div>
      )}
    </section>
  );
}
