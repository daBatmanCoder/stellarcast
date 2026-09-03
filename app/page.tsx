'use client';

import { useState, useEffect } from 'react';
import { StealthIdentity } from '@/lib/types/stealth';
import {
  generateStealthIdentity,
  identityToMetaAddress,
  encodeMetaAddress,
} from '@/lib/crypto/identity';
import {
  storeIdentity,
  loadIdentity,
  hasIdentity,
} from '@/lib/storage/identity-store';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import {
  getProtocolAdapter,
  setProtocolAdapter,
  MockProtocolAdapter,
} from '@/lib/protocol/adapters';

type ViewState = 
  | 'landing'
  | 'wallet-connect'
  | 'event-browse'
  | 'payment-flow'
  | 'access-granted'
  | 'livestream';

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'confirmed'>('idle');
  const [accessCredential, setAccessCredential] = useState<string>('');
  const [livestreamActive, setLivestreamActive] = useState(false);

  useEffect(() => {
    const mockAdapter = new MockProtocolAdapter();
    setProtocolAdapter(mockAdapter);

    const creatorIdentity = generateStealthIdentity();
    const creatorMeta = identityToMetaAddress(creatorIdentity);
    mockAdapter.registerMetaAddress('0xCREATOR...ADDRESS', creatorMeta);
  }, []);

  const handleWalletConnect = async () => {
    const password = 'demo-secure-password';
    
    const exists = await hasIdentity();
    let userIdentity: StealthIdentity;
    
    if (exists) {
      const loaded = await loadIdentity(password);
      if (loaded) {
        userIdentity = loaded;
      } else {
        userIdentity = generateStealthIdentity();
        await storeIdentity(userIdentity, password);
      }
    } else {
      userIdentity = generateStealthIdentity();
      await storeIdentity(userIdentity, password);
    }
    
    setIdentity(userIdentity);
    const meta = identityToMetaAddress(userIdentity);
    setMetaAddress(encodeMetaAddress(meta));
    setWalletConnected(true);
    setViewState('event-browse');
  };

  const handlePayForAccess = async () => {
    setViewState('payment-flow');
    setPaymentStatus('processing');

    const adapter = getProtocolAdapter();
    const creatorAddress = '0xCREATOR...ADDRESS';
    const creatorMeta = await adapter.getMetaAddress(creatorAddress);

    if (creatorMeta) {
      const stealthPayment = generateStealthAddress(creatorMeta);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const credential = `ACCESS_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      setAccessCredential(credential);
      setPaymentStatus('confirmed');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setViewState('access-granted');
    }
  };

  const handleEnterLivestream = () => {
    setViewState('livestream');
    setLivestreamActive(true);
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10 max-w-6xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-gold-400 bg-clip-text text-transparent glow-cyan">
                STELLARCAST
              </h1>
              <p className="text-cyan-300/60 text-sm mt-1">Private Livestream Events</p>
            </div>
            {walletConnected && (
              <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-cyan-300">Connected</span>
              </div>
            )}
          </div>
        </header>

        {viewState === 'landing' && (
          <div className="space-y-8 mt-20">
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-bold mb-4">
                <span className="glow-cyan">Private</span>{' '}
                <span className="glow-violet">Livestream</span>{' '}
                <span className="glow-gold">Events</span>
              </h2>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Pay for exclusive livestream access using privacy-preserving stealth addresses.
                Watch without revealing your identity on-chain.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
                <span>⚡</span>
                <span>Demo Mode - Simulated Payment Flow</span>
              </div>
            </div>

            <div className="glass-panel-bright rounded-2xl p-8 max-w-2xl mx-auto event-card">
              <div className="space-y-6">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-violet-900/50 to-cyan-900/50">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/80 rounded-full text-xs font-bold livestream-indicator">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        LIVE EVENT
                      </div>
                      <h3 className="text-3xl font-bold glow-cyan">The Midnight Session</h3>
                      <p className="text-slate-300">Exclusive performance by stellar artist</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Creator</p>
                    <p className="font-mono text-cyan-300">stellar.eth</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Access Price</p>
                    <p className="text-2xl font-bold text-gold-400 glow-gold">0.05 ETH</p>
                  </div>
                </div>

                <button
                  onClick={() => setViewState('wallet-connect')}
                  className="w-full btn-primary text-white font-bold py-4 px-8 rounded-xl"
                >
                  Connect Wallet to View
                </button>

                <div className="text-xs text-slate-400 text-center space-y-1">
                  <p>✓ Private payment via ERC-5564 stealth addresses</p>
                  <p>✓ On-chain privacy - your identity stays hidden</p>
                  <p>✓ Encrypted access credential delivery</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewState === 'wallet-connect' && (
          <div className="max-w-lg mx-auto mt-20">
            <div className="glass-panel rounded-2xl p-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-500 to-violet-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold glow-violet">Connect Wallet</h2>
                <p className="text-slate-300">
                  Generate your private stealth identity for anonymous event access
                </p>
              </div>

              <button
                onClick={handleWalletConnect}
                className="w-full btn-primary text-white font-bold py-4 px-8 rounded-xl"
              >
                Connect & Generate Identity
              </button>

              <div className="text-xs text-slate-400 space-y-2">
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400">🔐</span>
                  <span>Your identity keys are encrypted locally using PBKDF2 + AES-256-GCM</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-violet-400">🎭</span>
                  <span>Payments go to stealth addresses - preserving your privacy on-chain</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {viewState === 'event-browse' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4 glow-cyan">Featured Live Events</h2>
              
              <div className="glass-panel-bright rounded-xl p-6 space-y-6 event-card">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-48 h-32 rounded-lg bg-gradient-to-br from-violet-900/50 to-cyan-900/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-2 py-1 bg-red-500/80 rounded-full text-xs font-bold mb-2 livestream-indicator">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        LIVE
                      </div>
                      <p className="text-sm text-slate-300">Now Streaming</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-2xl font-bold glow-violet">The Midnight Session</h3>
                      <p className="text-slate-300 mt-1">
                        Exclusive performance and behind-the-scenes with stellar artist
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-slate-400">Creator:</span>
                        <span className="ml-2 font-mono text-cyan-300">stellar.eth</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Price:</span>
                        <span className="ml-2 font-bold text-gold-400">0.05 ETH</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Viewers:</span>
                        <span className="ml-2 text-green-400">247 watching</span>
                      </div>
                    </div>

                    <button
                      onClick={handlePayForAccess}
                      className="btn-primary text-white font-bold py-3 px-8 rounded-lg"
                    >
                      Pay for Private Access
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 text-slate-300">How It Works</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400 font-bold">1</div>
                  <h4 className="font-semibold text-cyan-300">Pay Privately</h4>
                  <p className="text-xs text-slate-400">Payment sent to creator's stealth address</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center text-violet-400 font-bold">2</div>
                  <h4 className="font-semibold text-violet-300">Get Credential</h4>
                  <p className="text-xs text-slate-400">Receive encrypted access token</p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center text-gold-400 font-bold">3</div>
                  <h4 className="font-semibold text-gold-300">Watch Anonymous</h4>
                  <p className="text-xs text-slate-400">Stream without revealing identity</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewState === 'payment-flow' && (
          <div className="max-w-2xl mx-auto mt-20">
            <div className="glass-panel rounded-2xl p-8 space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full flex items-center justify-center">
                  {paymentStatus === 'processing' && (
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {paymentStatus === 'confirmed' && (
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <h2 className="text-2xl font-bold glow-cyan">
                  {paymentStatus === 'processing' ? 'Processing Payment' : 'Payment Confirmed'}
                </h2>
              </div>

              <div className="space-y-4 status-rail status-active">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                    <span className="text-sm font-semibold text-cyan-300">Generating stealth address</span>
                  </div>
                  <p className="text-xs text-slate-400 ml-4">
                    Creating one-time payment address for creator
                  </p>
                </div>

                {paymentStatus !== 'idle' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-violet-400 rounded-full"></div>
                      <span className="text-sm font-semibold text-violet-300">Publishing encrypted payment</span>
                    </div>
                    <p className="text-xs text-slate-400 ml-4">
                      ERC-5564 announcement with payment proof
                    </p>
                  </div>
                )}

                {paymentStatus === 'confirmed' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gold-400 rounded-full"></div>
                      <span className="text-sm font-semibold text-gold-300">Receiving access credential</span>
                    </div>
                    <p className="text-xs text-slate-400 ml-4">
                      Encrypted token delivered via secure channel
                    </p>
                  </div>
                )}
              </div>

              {paymentStatus === 'confirmed' && (
                <div className="glass-panel-bright rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-2">Access Credential</p>
                  <p className="font-mono text-sm text-cyan-300 break-all">{accessCredential}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewState === 'access-granted' && (
          <div className="max-w-2xl mx-auto mt-20">
            <div className="glass-panel rounded-2xl p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold glow-cyan">Access Granted</h2>
                <p className="text-slate-300">
                  Your private access credential is ready. Enter the livestream anonymously.
                </p>
              </div>

              <div className="glass-panel-bright rounded-lg p-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Event</span>
                  <span className="text-cyan-300 font-semibold">The Midnight Session</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Creator</span>
                  <span className="font-mono text-violet-300">stellar.eth</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Verified Access
                  </span>
                </div>
              </div>

              <button
                onClick={handleEnterLivestream}
                className="w-full btn-primary text-white font-bold py-4 px-8 rounded-xl text-lg"
              >
                Enter Private Livestream
              </button>

              <div className="text-center text-xs text-slate-400 space-y-1">
                <p>✓ Payment processed via stealth address</p>
                <p>✓ Your identity remains private on-chain</p>
                <p>✓ Encrypted peer-to-peer connection ready</p>
              </div>
            </div>
          </div>
        )}

        {viewState === 'livestream' && (
          <div className="space-y-6">
            <div className="glass-panel-bright rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-gradient-to-br from-violet-900/30 to-cyan-900/30">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-red-500/90 rounded-full font-bold livestream-indicator">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                      <span>LIVE NOW</span>
                    </div>
                    <h2 className="text-4xl font-bold glow-cyan">The Midnight Session</h2>
                    <p className="text-slate-300">Private Livestream Active</p>
                    <div className="flex items-center justify-center gap-8 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-300">Connected via WebRTC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-cyan-300">248 viewers</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold glow-violet">Private Viewing Mode</h3>
                    <p className="text-sm text-slate-400">Your identity is protected</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-300 font-semibold">Anonymous</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="glass-panel rounded-lg p-3">
                    <p className="text-slate-400 mb-1">Connection</p>
                    <p className="text-cyan-300 font-semibold">P2P Encrypted</p>
                  </div>
                  <div className="glass-panel rounded-lg p-3">
                    <p className="text-slate-400 mb-1">On-Chain Activity</p>
                    <p className="text-green-400 font-semibold">Zero After Access</p>
                  </div>
                  <div className="glass-panel rounded-lg p-3">
                    <p className="text-slate-400 mb-1">Quality</p>
                    <p className="text-violet-300 font-semibold">1080p HD</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <h4 className="font-bold mb-4 text-slate-300">Privacy Details</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-cyan-500/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cyan-400">✓</span>
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold">Stealth Payment Complete</p>
                    <p className="text-slate-400">Payment sent to one-time address - not linked to your identity</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-violet-500/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-violet-400">✓</span>
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold">WebRTC P2P Connection</p>
                    <p className="text-slate-400">Direct encrypted stream - no blockchain activity during viewing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gold-500/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-gold-400">✓</span>
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold">Anonymous Viewing</p>
                    <p className="text-slate-400">Your identity remains private throughout the experience</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-16 text-center text-xs text-slate-500">
          <div className="glass-panel inline-block px-6 py-3 rounded-lg">
            <p className="mb-1">
              <span className="text-amber-400">⚡ Hackathon Demo</span> - 
              Simulated payment and livestream. Privacy architecture is functional.
            </p>
            <p>
              ERC-5564 Stealth Addresses • ERC-6538 Meta-Address Registry • Encrypted WebRTC Signaling
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
