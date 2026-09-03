'use client';

import { useState, useEffect } from 'react';
import type { StealthIdentity } from '@/lib/types/stealth';
import { identityToMetaAddress, generateStealthIdentity } from '@/lib/crypto/identity';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import {
  getProtocolAdapter,
  setProtocolAdapter,
  MockProtocolAdapter,
  LiveProtocolAdapter,
} from '@/lib/protocol/adapters';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { deriveAccessCredential } from '@/lib/crypto/credentials';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { SEPOLIA_CHAIN_ID } from '@/lib/blockchain/contracts';
import { Hero } from '@/components/Hero';
import { WalletConnect } from '@/components/WalletConnect';
import { NetworkGuard } from '@/components/NetworkGuard';
import { Browse } from '@/components/Browse';
import { PaymentSlideOver } from '@/components/PaymentSlideOver';
import { RecipientScan } from '@/components/RecipientScan';
import { ensCache, type ENSResult } from '@/lib/ens/resolver';

type ViewState = 'landing' | 'wallet-connect' | 'browse' | 'scan' | 'stream';
type PaymentStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [paymentSlideOverOpen, setPaymentSlideOverOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [headerEnsResult, setHeaderEnsResult] = useState<ENSResult | null>(null);
  
  const metamask = useMetaMask();

  // Resolve header ENS name
  useEffect(() => {
    const resolveHeaderENS = async () => {
      if (metamask.isConnected && metamask.address && identity) {
        const result = await ensCache.resolve(metamask.address);
        setHeaderEnsResult(result);
      } else {
        setHeaderEnsResult(null);
      }
    };

    resolveHeaderENS();
  }, [metamask.isConnected, metamask.address, identity]);

  // Initialize protocol adapter
  useEffect(() => {
    const initAdapter = async () => {
      // Check Sepolia contracts
      if (metamask.isConnected && metamask.chainId === '0xaa36a7') {
        const { checkRegistryDeployed, checkAnnouncerDeployed } = await import('../lib/blockchain/contracts');
        
        try {
          const registryExists = await checkRegistryDeployed('0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538');
          const announcerExists = await checkAnnouncerDeployed('0x55649E01B5Df198D18D95b5cc5051630cfD45564');
          
          if (registryExists && announcerExists) {
            const liveAdapter = new LiveProtocolAdapter(
              SEPOLIA_CHAIN_ID,
              '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538',
              '0x55649E01B5Df198D18D95b5cc5051630cfD45564'
            );
            setProtocolAdapter(liveAdapter);
            return;
          }
        } catch (error) {
          console.error('Error checking contracts:', error);
        }
      }

      // Fallback to mock
      const mockAdapter = new MockProtocolAdapter();
      const creatorIdentity = generateStealthIdentity();
      const creatorMeta = identityToMetaAddress(creatorIdentity);
      mockAdapter.registerMetaAddress('0x1234...5678', creatorMeta);
      setProtocolAdapter(mockAdapter);
    };

    initAdapter();
  }, [metamask.isConnected, metamask.chainId]);

  const handleIdentityReady = (userIdentity: StealthIdentity, userMetaAddress: string) => {
    setIdentity(userIdentity);
    setMetaAddress(userMetaAddress);
    setViewState('browse');
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setPaymentSlideOverOpen(true);
    setPaymentStatus('idle');
    setPaymentError('');
    setTxHash('');
  };

  const handleConfirmPayment = async () => {
    if (!identity || !metamask.address) {
      setPaymentError('Please connect wallet first');
      return;
    }

    setPaymentStatus('pending');
    setPaymentError('');
    setTxHash('');

    const adapter = getProtocolAdapter();
    const creatorAddress = '0x1234...5678';
    
    try {
      const creatorMeta = await adapter.getMetaAddress(creatorAddress);

      if (!creatorMeta) {
        throw new Error('Creator has not registered a stealth meta-address');
      }

      const stealthPayment = generateStealthAddress(creatorMeta);
      const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');
      
      // Send real payment transaction
      const hash = await sendEthTransaction(
        metamask.address,
        stealthAddressHex,
        '0.05' // 0.05 ETH as shown in UI
      );
      setTxHash(hash);
      setPaymentStatus('confirming');
      
      await waitForTransactionReceipt(hash);
      
      setPaymentStatus('success');
      
      // Auto-transition to stream after success
      setTimeout(() => {
        setPaymentSlideOverOpen(false);
        setViewState('stream');
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMsg);
      setPaymentStatus('error');
    }
  };

  // Initialize WebRTC when entering stream view
  useEffect(() => {
    const initWebRTC = async () => {
      if (viewState !== 'stream') return;

      try {
        const { createPeerConnection, onConnectionStateChange, getUserMedia } = await import('@/lib/webrtc/video-stream');
        
        // Create peer connection
        const pc = createPeerConnection();
        setPeerConnection(pc);

        // Monitor connection state
        onConnectionStateChange(pc, (state) => {
          setConnectionState(state);
        });

        // Get local media stream (for demo/preview)
        try {
          const stream = await getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
        } catch (mediaError) {
          console.warn('Could not access media devices:', mediaError);
          // Stream view still works without local media
        }
      } catch (error) {
        console.error('WebRTC initialization failed:', error);
      }
    };

    initWebRTC();
  }, [viewState]);

  // Cleanup WebRTC on unmount or leaving stream
  useEffect(() => {
    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [peerConnection, localStream]);

  // Landing view
  if (viewState === 'landing') {
    return (
      <main className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
        <Hero onGetStarted={() => setViewState('wallet-connect')} />
      </main>
    );
  }

  // Wallet connect view
  if (viewState === 'wallet-connect') {
    return (
      <main className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
        <WalletConnect onIdentityReady={handleIdentityReady} />
      </main>
    );
  }

  // Authenticated views with network guard
  return (
    <NetworkGuard>
      <main className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
        {/* Header */}
        <header className="sticky top-0 z-30" style={{ 
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'rgba(10, 10, 12, 0.8)',
          backdropFilter: 'blur(12px)'
        }}>
          <div className="container-custom">
            <div className="flex items-center justify-between py-4">
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Stellarcast
              </h1>
              
              {metamask.isConnected && (
                <div className="card px-3 py-2 flex items-center gap-2">
                  <div className="status-dot" style={{ backgroundColor: 'var(--success)' }}></div>
                  <div className="flex flex-col min-w-0">
                    {headerEnsResult ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold truncate" style={{ color: 'var(--accent)' }}>
                            {headerEnsResult.name}
                          </span>
                          {headerEnsResult.network === 'mainnet' && (
                            <span className="text-[9px] px-1 rounded" style={{ 
                              color: 'var(--text-tertiary)', 
                              backgroundColor: 'var(--elevated)',
                              fontStyle: 'italic'
                            }}>
                              mainnet
                            </span>
                          )}
                        </div>
                        <span className="mono text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {metamask.address?.slice(0, 6)}...{metamask.address?.slice(-4)}
                        </span>
                      </>
                    ) : (
                      <span className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {metamask.address?.slice(0, 6)}...{metamask.address?.slice(-4)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            {(viewState === 'browse' || viewState === 'scan') && (
              <div className="flex gap-1 -mb-px">
                <button
                  onClick={() => setViewState('browse')}
                  className="px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    color: viewState === 'browse' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    borderBottom: viewState === 'browse' ? '2px solid var(--accent)' : '2px solid transparent'
                  }}
                >
                  Browse
                </button>
                <button
                  onClick={() => setViewState('scan')}
                  className="px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    color: viewState === 'scan' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    borderBottom: viewState === 'scan' ? '2px solid var(--accent)' : '2px solid transparent'
                  }}
                >
                  Scan
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Browse Events */}
        {viewState === 'browse' && (
          <Browse 
            adapter={getProtocolAdapter()} 
            onSelectEvent={handleSelectEvent} 
          />
        )}

        {/* Recipient Scan */}
        {viewState === 'scan' && identity && (
          <RecipientScan
            identity={identity}
            registryAddress="0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538"
            announcerAddress="0x55649E01B5Df198D18D95b5cc5051630cfD45564"
          />
        )}

        {/* Payment Slide-Over */}
        <PaymentSlideOver
          isOpen={paymentSlideOverOpen}
          onClose={() => setPaymentSlideOverOpen(false)}
          eventTitle="Private Crypto Workshop"
          price="0.05 ETH"
          onConfirm={handleConfirmPayment}
          status={paymentStatus}
          txHash={txHash}
          error={paymentError}
        />

        {/* Stream View */}
        {viewState === 'stream' && (
          <div className="container-custom py-12">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Video player */}
              <div className="relative aspect-video rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--elevated)' }}>
                {/* Live indicator */}
                <div className="absolute top-4 left-4 z-10 live-indicator">
                  <span className="live-dot"></span>
                  LIVE
                </div>

                {/* Connection state badge */}
                <div className="absolute top-4 right-4 z-10 card px-3 py-1 flex items-center gap-2">
                  <div 
                    className="status-dot"
                    style={{
                      backgroundColor: connectionState === 'connected' ? 'var(--success)' :
                                     connectionState === 'connecting' ? 'var(--warn)' :
                                     'var(--text-tertiary)'
                    }}
                  ></div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {connectionState === 'connected' ? 'Connected' :
                     connectionState === 'connecting' ? 'Connecting...' :
                     connectionState === 'new' ? 'Ready' :
                     connectionState}
                  </span>
                </div>

                {/* Video element */}
                {localStream ? (
                  <video
                    ref={(video) => {
                      if (video && localStream) {
                        video.srcObject = localStream;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <h2 style={{ fontSize: '2rem', fontWeight: 600 }}>
                        Private Crypto Workshop
                      </h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {peerConnection ? 'WebRTC connection ready' : 'Initializing...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream info */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Private Viewing Mode</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Your identity is protected via stealth address payment
                    </p>
                  </div>
                  <div className="card px-3 py-2" style={{ borderColor: 'var(--success)' }}>
                    <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                      Anonymous
                    </span>
                  </div>
                </div>

                {/* WebRTC info */}
                {peerConnection && (
                  <div className="card p-4 space-y-2" style={{ backgroundColor: 'var(--elevated)' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
                      WebRTC Active
                    </p>
                    <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                      <li>• RTCPeerConnection initialized</li>
                      <li>• STUN servers configured</li>
                      <li>• {localStream ? 'Local media stream active' : 'Ready for signaling'}</li>
                      <li>• Connection state: {connectionState}</li>
                    </ul>
                    <p className="text-xs pt-2" style={{ color: 'var(--text-tertiary)' }}>
                      Note: Full peer-to-peer requires signaling server (offer/answer exchange)
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setViewState('browse');
                    // Cleanup handled by useEffect
                  }}
                  className="btn btn-secondary"
                >
                  Leave Stream
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </NetworkGuard>
  );
}
