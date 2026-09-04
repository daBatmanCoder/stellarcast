'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltip?: string;
  tooltipSide?: 'top' | 'right';
  children: ReactNode;
  size?: number;
  active?: boolean;
}

export function IconButton({
  label,
  tooltip,
  tooltipSide = 'top',
  children,
  size = 32,
  active,
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  const tip = tooltip || label;
  return (
    <button
      type={type}
      aria-label={label}
      data-tooltip={tip}
      className={`has-tooltip icon-btn ${active ? 'icon-btn--active' : ''} ${className}`.trim()}
      data-tooltip-side={tooltipSide === 'right' ? 'right' : undefined}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: 'var(--text-primary)',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'background-color var(--duration-fast) ease, color var(--duration-fast) ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled && !active) e.currentTarget.style.background = 'var(--bg-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
      {...props}
    >
      {children}
    </button>
  );
}
