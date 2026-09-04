'use client';

export function SkeletonCard() {
  return (
    <div aria-hidden style={{ width: '100%' }}>
      <div className="skeleton" style={{ aspectRatio: '16 / 9', width: '100%' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div className="skeleton-block" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton-block" style={{ height: 14, width: '90%', marginBottom: 6 }} />
          <div className="skeleton-block" style={{ height: 12, width: '55%', marginBottom: 4 }} />
          <div className="skeleton-block" style={{ height: 12, width: '40%' }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCategoryCard() {
  return (
    <div aria-hidden style={{ width: '100%' }}>
      <div className="skeleton" style={{ aspectRatio: '3 / 4', width: '100%' }} />
      <div className="skeleton-block" style={{ height: 14, width: '70%', marginTop: 8, marginBottom: 4 }} />
      <div className="skeleton-block" style={{ height: 12, width: '45%' }} />
    </div>
  );
}
