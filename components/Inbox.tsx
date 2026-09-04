'use client';

import { useState } from 'react';

export interface InboxMessage {
  id: string;
  roomId: string;
  roomTitle: string;
  encryptedPassword: string;
  timestamp: string;
  isRead: boolean;
}

interface InboxProps {
  messages: InboxMessage[];
  isOpen: boolean;
  onToggle: () => void;
  onUsePassword: (message: InboxMessage) => void;
}

export function Inbox({ messages, isOpen, onToggle, onUsePassword }: InboxProps) {
  return (
    <>
      {/* Inbox toggle button (fixed bottom-right when closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-lg transition-transform hover:scale-105"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'white'
          }}
        >
          <div className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-10 7L2 7" />
            </svg>
            {messages.filter(m => !m.isRead).length > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--live)',
                  color: 'white'
                }}
              >
                {messages.filter(m => !m.isRead).length}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Inbox panel (fixed right when open) */}
      {isOpen && (
        <aside
          className="fixed right-0 bottom-0 overflow-y-auto z-40"
          style={{
            top: '48px',
            width: '320px',
            backgroundColor: 'var(--elevated)',
            borderLeft: '1px solid var(--border)'
          }}
        >
          {/* Header */}
          <div
            className="sticky top-0 p-4 flex items-center justify-between border-b z-10"
            style={{
              backgroundColor: 'var(--elevated)',
              borderColor: 'var(--border)'
            }}
          >
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Inbox
            </h2>
            <button
              onClick={onToggle}
              className="text-xl hover:text-[var(--text-primary)] transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📬</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No messages yet
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Room passwords will appear here after payment
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-lg p-4 space-y-3"
                  style={{
                    backgroundColor: message.isRead ? 'var(--surface)' : 'rgba(145, 70, 255, 0.1)',
                    border: message.isRead ? '1px solid var(--border)' : '1px solid rgba(145, 70, 255, 0.3)'
                  }}
                >
                  {!message.isRead && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--accent)' }}
                      ></div>
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                        New
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                      Room Access: {message.roomTitle}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(message.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <div
                    className="p-2 rounded mono text-xs break-all"
                    style={{
                      backgroundColor: 'var(--elevated)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {message.encryptedPassword.slice(0, 32)}...
                  </div>

                  <button
                    onClick={() => onUsePassword(message)}
                    className="w-full py-2 rounded text-sm font-semibold transition-colors"
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
                    Use Password
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </>
  );
}
