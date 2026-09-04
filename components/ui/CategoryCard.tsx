'use client';

import { assetPath, formatViewerCount } from '@/lib/utils/asset';
import { Tag } from './Badges';

export interface CategoryItem {
  id: string;
  name: string;
  poster: string;
  viewers: number;
  tags?: string[];
}

interface CategoryCardProps {
  category: CategoryItem;
  onSelect?: (category: CategoryItem) => void;
}

export function CategoryCard({ category, onSelect }: CategoryCardProps) {
  return (
    <button
      type="button"
      className="category-card"
      onClick={() => onSelect?.(category)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        cursor: onSelect ? 'pointer' : 'default',
        color: 'inherit',
        padding: 0,
      }}
    >
      <div className="thumbnail-wrapper">
        <div className="category-thumb-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetPath(category.poster)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </div>
      <p
        className="category-card-title truncate-1"
        style={{
          fontSize: 14,
          fontWeight: 600,
          margin: '8px 0 2px',
          color: 'var(--text-primary)',
          transition: 'color var(--duration-fast) ease',
        }}
      >
        {category.name}
      </p>
      <p className="truncate-1" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        {formatViewerCount(category.viewers)} viewers
      </p>
      {category.tags && category.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {category.tags.slice(0, 2).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
    </button>
  );
}
