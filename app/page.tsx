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

type ViewState = 'landing' | 'wallet-connect' | 'browse' | 'stream';
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
  
  const metamask = useMetaMask();

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup logic if needed
    };
  }, []);

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
          <div className="container-custom py-4">
            <div className="flex items-center justify-between">
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Stellarcast
              </h1>
              
              {metamask.isConnected && (
                <div className="card px-3 py-2 flex items-center gap-2">
                  <div className="status-dot" style={{ backgroundColor: 'var(--success)' }}></div>
                  <span className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {metamask.address?.slice(0, 6)}...{metamask.address?.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Browse Events */}
        {viewState === 'browse' && (
          <Browse 
            adapter={getProtocolAdapter()} 
            onSelectEvent={handleSelectEvent} 
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
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      LIVE
                    </div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 600 }}>
                      Private Crypto Workshop
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      WebRTC stream placeholder
                    </p>
                  </div>
                </div>
              </div>

              {/* Stream info */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Private Viewing Mode</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Your identity is protected
                    </p>
                  </div>
                  <div className="card px-3 py-2" style={{ borderColor: 'var(--success)' }}>
                    <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                      Anonymous
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setViewState('browse')}
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
