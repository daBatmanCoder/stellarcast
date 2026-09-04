'use client';

import { useState } from 'react';
import { ModalShell } from './ModalShell';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

interface GoLiveModalProps {
  isOpen: boolean;
  ensName: string;
  metaAddress: string;
  onClose: () => void;
  onStartStream: (title: string, category: string) => void;
}

export function GoLiveModal({ isOpen, ensName, metaAddress, onClose, onStartStream }: GoLiveModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Science & Technology');

  const categories = [
    'Science & Technology',
    'Software Development',
    'Finance',
    'Art',
    'Events',
    'Community',
    'Education',
    'Gaming',
    'Music',
    'Other'
  ];

  const handleStart = () => {
    if (title.trim()) {
      onStartStream(title, category);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose={true} mobileBottomSheet={true}>
      {/* Accent rail */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'var(--live)',
        borderRadius: '24px 24px 0 0'
      }} />

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.48)',
          cursor: 'pointer',
          transition: 'all 150ms ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.48)';
        }}
      >
        <CloseIcon />
      </button>

      {/* Header */}
      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ 
          fontSize: '22px', 
          lineHeight: '28px', 
          fontWeight: 700,
          color: '#FFFFFF',
          marginBottom: '8px'
        }}>
          Go Live
        </h2>
        <p style={{ 
          fontSize: '14px', 
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          Start streaming with private stealth payments
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px 0' }}>
        {/* Identity Display */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'rgba(124, 92, 255, 0.1)',
          border: '1px solid rgba(124, 92, 255, 0.3)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '8px' }}>
            Your stream identity
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
              {ensName}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓</span>
          </div>
          <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.48)' }}>
            Stealth meta-address: {metaAddress.slice(0, 18)}...{metaAddress.slice(-16)}
          </p>
        </div>

        {/* Stream Title */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.88)',
            marginBottom: '8px'
          }}>
            Stream Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you streaming?"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.88)',
            marginBottom: '8px'
          }}>
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
          >
            {categories.map(cat => (
              <option key={cat} value={cat} style={{ backgroundColor: '#16161D' }}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Info */}
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 245, 147, 0.1)',
          border: '1px solid rgba(0, 245, 147, 0.3)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.80)' }}>
            💡 Viewers will pay to your stealth meta-address. Each payment generates a unique stealth address, keeping transactions private.
          </p>
        </div>
      </div>

      {/* CTA stack */}
      <div style={{ padding: '8px 24px 24px' }}>
        <button
          onClick={handleStart}
          disabled={!title.trim()}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: title.trim() ? 'var(--live)' : 'rgba(235, 4, 0, 0.5)',
            border: 'none',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 150ms ease'
          }}
          onMouseEnter={(e) => {
            if (title.trim()) {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Start Streaming
        </button>
      </div>
    </ModalShell>
  );
}
