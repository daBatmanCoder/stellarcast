'use client';

import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconClose, IconInbox } from './ui/Icons';

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
  if (!isOpen) return null;

  return (
    <aside
      className="inbox-panel scroll-y"
      aria-label="Access inbox"
      style={{
        position: 'fixed',
        top: 'var(--nav-height)',
        right: 0,
        bottom: 0,
        width: 'min(var(--panel-width), 100vw)',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconInbox size={18} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Inbox</h2>
        </div>
        <IconButton label="Close inbox" onClick={onToggle}>
          <IconClose size={18} />
        </IconButton>
      </header>

      <div className="scroll-y" style={{ flex: 1, padding: 12 }}>
        {messages.length === 0 ? (
          <EmptyState
            title="No access keys yet"
            description="Room credentials appear here after a successful stealth payment."
            icon={<IconInbox size={28} />}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((message) => (
              <article
                key={message.id}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  background: message.isRead ? 'var(--bg-body)' : 'rgba(145, 71, 255, 0.08)',
                  border: `1px solid ${message.isRead ? 'var(--border-subtle)' : 'rgba(145, 71, 255, 0.35)'}`,
                }}
              >
                {!message.isRead && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', margin: '0 0 6px' }}>
                    New
                  </p>
                )}
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                  Access: {message.roomTitle}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  {new Date(message.timestamp).toLocaleString()}
                </p>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 8,
                    wordBreak: 'break-all',
                    marginBottom: 8,
                  }}
                >
                  {message.encryptedPassword.slice(0, 40)}…
                </div>
                <Button variant="primary" size="sm" fullWidth onClick={() => onUsePassword(message)}>
                  Use access key
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .inbox-panel {
            left: 0 !important;
            width: 100vw !important;
            border-left: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
