'use client';

export function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden">
      {/* Soft radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(124, 92, 255, 0.15) 0%, transparent 70%)'
          }}
        ></div>
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-12 animate-fade-in">
          <div className="space-y-6">
            <h1 style={{ fontWeight: 600, letterSpacing: '-0.03em' }}>
              Stellarcast
            </h1>
            <p className="text-xl md:text-2xl" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Private livestream access via stealth addresses
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onGetStarted}
              className="btn btn-primary"
            >
              Connect Wallet
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto pt-12">
            <div className="space-y-3 text-center">
              <div className="text-3xl">🔐</div>
              <h3 className="font-semibold text-base">Private Payments</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                ERC-5564 stealth addresses
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="text-3xl">📹</div>
              <h3 className="font-semibold text-base">Live Streaming</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Real-time WebRTC video
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="text-3xl">🔒</div>
              <h3 className="font-semibold text-base">Wallet-Bound Auth</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                secp256k1 cryptography
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
