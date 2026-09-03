'use client';

interface PaymentSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  price: string;
  onConfirm: () => void;
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  error?: string;
}

export function PaymentSlideOver({
  isOpen,
  onClose,
  eventTitle,
  price,
  onConfirm,
  status,
  txHash,
  error
}: PaymentSlideOverProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        style={{ backdropFilter: 'blur(4px)' }}
      ></div>

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 w-full md:max-w-md bg-[var(--surface)] z-50 overflow-y-auto animate-fade-in"
        style={{
          borderLeft: '1px solid var(--border)',
          animation: 'slideInRight 250ms var(--ease-out)'
        }}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              Payment
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--elevated)] rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Event summary */}
          <div className="card p-4 space-y-2">
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Event
            </p>
            <p style={{ fontSize: '15px', fontWeight: 600 }}>
              {eventTitle}
            </p>
          </div>

          {/* Price breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-secondary)' }}>Price</span>
              <span className="mono text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {price}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Network</span>
              <span style={{ color: 'var(--text-secondary)' }}>Sepolia</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Estimated gas</span>
              <span style={{ color: 'var(--text-secondary)' }}>~0.001 ETH</span>
            </div>
          </div>

          {/* Status / Error */}
          {status === 'error' && error && (
            <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {error}
              </p>
            </div>
          )}

          {status === 'success' && txHash && (
            <div className="card p-4" style={{ borderColor: 'var(--success)' }}>
              <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Payment successful!
              </p>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs block truncate"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                View transaction →
              </a>
            </div>
          )}

          {/* Action button */}
          {status === 'idle' && (
            <button
              onClick={onConfirm}
              className="btn btn-primary w-full"
            >
              Confirm Payment
            </button>
          )}

          {status === 'pending' && (
            <button
              disabled
              className="btn btn-primary w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    animation: 'spin 1s linear infinite'
                  }}
                ></div>
                Sending...
              </span>
            </button>
          )}

          {status === 'confirming' && (
            <button
              disabled
              className="btn btn-primary w-full"
            >
              Confirming...
            </button>
          )}

          {status === 'success' && (
            <button
              onClick={onClose}
              className="btn btn-primary w-full"
            >
              Continue to Stream
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={onConfirm}
              className="btn btn-secondary w-full"
            >
              Retry
            </button>
          )}

          {/* Privacy info */}
          <div className="pt-4 text-xs space-y-2" style={{ color: 'var(--text-tertiary)' }}>
            <p>
              🔐 Payment sent to a stealth address for privacy
            </p>
            <p>
              🎭 Your identity remains private on-chain
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
