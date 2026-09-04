'use client';

import { CategoryCard, type CategoryItem } from './ui/CategoryCard';
import { SectionHeader } from './ui/SectionHeader';
import { SkeletonCategoryCard } from './ui/SkeletonCard';

interface CategoryShelfProps {
  categories: CategoryItem[];
  onSelectCategory?: (category: CategoryItem) => void;
  loading?: boolean;
}

export function CategoryShelf({ categories, onSelectCategory, loading }: CategoryShelfProps) {
  return (
    <section className="content-shelf" aria-label="Categories">
      <SectionHeader title="Popular categories" />
      {loading ? (
        <div className="category-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCategoryCard key={i} />
          ))}
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} onSelect={onSelectCategory} />
          ))}
        </div>
      )}
    </section>
  );
}
