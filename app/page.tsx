'use client';

import { useState, useEffect } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { NetworkGuard } from '@/components/NetworkGuard';
import { TopNav } from '@/components/TopNav';
import { LeftRail } from '@/components/LeftRail';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { LiveGrid } from '@/components/LiveGrid';
import { Inbox, type InboxMessage } from '@/components/Inbox';
import { ENSIdentityModal } from '@/components/ENSIdentityModal';
import { PaymentModal } from '@/components/PaymentModal';
import { WalletConnect } from '@/components/WalletConnect';
import { SEED_ROOMS, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import { identityToMetaAddress } from '@/lib/crypto/identity';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { storeENSVerification, getENSVerification } from '@/lib/storage/ens-store';

export default function Home() {
  const metamask = useMetaMask();
  
  // Auth state
  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [verifiedEnsName, setVerifiedEnsName] = useState<string>('');
  const [needsWalletConnect, setNeedsWalletConnect] = useState(false);

  // UI state
  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [ensModalOpen, setEnsModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  
  // Demo state
  const [currentEnsForPayment, setCurrentEnsForPayment] = useState('');
  const featuredRoom = SEED_ROOMS.find(r => r.isFeatured) || SEED_ROOMS[0];

  // Check for existing verified ENS on mount
  useEffect(() => {
    const checkExistingENS = async () => {
      if (metamask.isConnected && metamask.address) {
        const existing = await getENSVerification(metamask.address);
        if (existing) {
          setVerifiedEnsName(existing.ensName);
        }
      }
    };
    checkExistingENS();
  }, [metamask.isConnected, metamask.address]);

  const handleIdentityReady = (userIdentity: StealthIdentity, userMetaAddress: string, ensName?: string) => {
    setIdentity(userIdentity);
    setMetaAddress(userMetaAddress);
    if (ensName) {
      setVerifiedEnsName(ensName);
    }
    setNeedsWalletConnect(false);
  };

  const handleConnectClick = () => {
    setNeedsWalletConnect(true);
  };

  const handleRoomSelect = (room: LiveRoom) => {
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      return;
    }

    if (!identity) {
      setNeedsWalletConnect(true);
      return;
    }

    setSelectedRoom(room);
    setEnsModalOpen(true);
  };

  const handleENSVerified = async (ensName: string, signature: string, message: string) => {
    // Store verified ENS
    if (metamask.address) {
      await storeENSVerification({
        walletAddress: metamask.address,
        ensName,
        chainId: 11155111,
        message,
        signature,
        verifiedAt: new Date().toISOString()
      });
      setVerifiedEnsName(ensName);
    }

    setCurrentEnsForPayment(ensName);
    setEnsModalOpen(false);
    
    // Open payment modal
    setTimeout(() => {
      setPaymentModalOpen(true);
    }, 300);
  };

  const handlePayment = async (): Promise<string> => {
    if (!identity || !selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    // Generate stealth address for the room host
    // In demo, we'll use a mock meta-address derived from the host address
    const meta = identityToMetaAddress(identity);
    const stealthPayment = generateStealthAddress(meta);
    const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');

    // Send real payment on Sepolia
    const txHash = await sendEthTransaction(
      metamask.address,
      stealthAddressHex,
      '0.01'
    );

    // Wait for confirmation (simplified for demo)
    await waitForTransactionReceipt(txHash);

    return txHash;
  };

  const handlePaymentSuccess = (txHash: string) => {
    if (!selectedRoom) return;

    // Create inbox message with encrypted password
    const encryptedPassword = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;

    const message: InboxMessage = {
      id: `msg-${Date.now()}`,
      roomId: selectedRoom.id,
      roomTitle: selectedRoom.title,
      encryptedPassword,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    setInboxMessages(prev => [message, ...prev]);
    setPaymentModalOpen(false);
    
    // Auto-open inbox and show notification
    setTimeout(() => {
      setInboxOpen(true);
    }, 500);
  };

  const handleUsePassword = (message: InboxMessage) => {
    // Mark as read
    setInboxMessages(prev =>
      prev.map(m => m.id === message.id ? { ...m, isRead: true } : m)
    );

    // In full implementation, this would join the WebRTC room
    alert(`Joining room with password: ${message.encryptedPassword.slice(0, 20)}...`);
    setInboxOpen(false);
  };

  // Show wallet connect if needed
  if (needsWalletConnect || (!identity && metamask.isConnected)) {
    return <WalletConnect onIdentityReady={handleIdentityReady} />;
  }

  return (
    <NetworkGuard>
      <div style={{ backgroundColor: 'var(--base)', minHeight: '100vh' }}>
        {/* Top Nav */}
        <TopNav
          isConnected={metamask.isConnected}
          address={metamask.address}
          verifiedEnsName={verifiedEnsName}
          onConnect={handleConnectClick}
        />

        {/* Left Rail */}
        <LeftRail
          rooms={SEED_ROOMS}
          onSelectRoom={handleRoomSelect}
        />

        {/* Main Content */}
        <main
          style={{
            marginLeft: '190px',
            paddingTop: '48px',
            minHeight: '100vh'
          }}
        >
          <div className="container-custom py-8">
            {/* Featured Carousel */}
            <FeaturedCarousel
              room={featuredRoom}
              onJoin={handleRoomSelect}
            />

            {/* Live Grid */}
            <LiveGrid
              rooms={SEED_ROOMS}
              onSelectRoom={handleRoomSelect}
            />

            {/* Categories strip could go here */}
            <div className="mt-12 space-y-4">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Categories
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {['Science & Technology', 'Software Development', 'Finance', 'Art', 'Events', 'Community'].map((cat) => (
                  <div
                    key={cat}
                    className="flex-shrink-0 w-32 h-44 rounded-lg flex items-end p-4 cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--live) 100%)',
                      opacity: 0.9
                    }}
                  >
                    <p className="text-sm font-semibold text-white">
                      {cat}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Inbox */}
        <Inbox
          messages={inboxMessages}
          isOpen={inboxOpen}
          onToggle={() => setInboxOpen(!inboxOpen)}
          onUsePassword={handleUsePassword}
        />

        {/* ENS Identity Modal */}
        <ENSIdentityModal
          isOpen={ensModalOpen}
          room={selectedRoom}
          walletAddress={metamask.address || ''}
          onClose={() => {
            setEnsModalOpen(false);
            setSelectedRoom(null);
          }}
          onVerified={handleENSVerified}
        />

        {/* Payment Modal */}
        <PaymentModal
          isOpen={paymentModalOpen}
          room={selectedRoom}
          ensName={currentEnsForPayment}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedRoom(null);
          }}
          onPay={handlePayment}
          onSuccess={handlePaymentSuccess}
        />
      </div>
    </NetworkGuard>
  );
}
