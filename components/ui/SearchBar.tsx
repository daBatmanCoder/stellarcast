'use client';

import { useId } from 'react';
import { IconSearch } from './Icons';
import { IconButton } from './IconButton';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
  onSubmit,
}: SearchBarProps) {
  const id = useId();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: 420,
        height: 36,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <label htmlFor={id} className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Search
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          padding: '0 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          outline: 'none',
          fontSize: 14,
        }}
        onFocus={(e) => {
          e.currentTarget.parentElement!.style.borderColor = 'var(--accent-primary)';
        }}
        onBlur={(e) => {
          e.currentTarget.parentElement!.style.borderColor = 'var(--border-subtle)';
        }}
      />
      <IconButton
        label="Search"
        type="submit"
        size={36}
        style={{ borderRadius: 0, borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
      >
        <IconSearch size={18} />
      </IconButton>
    </form>
  );
}
