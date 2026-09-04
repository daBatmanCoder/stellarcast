'use client';

import { useState, useEffect } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { NetworkGuard } from '@/components/NetworkGuard';
import { TopNav } from '@/components/TopNav';
import { LeftRail } from '@/components/LeftRail';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { LiveGrid } from '@/components/LiveGrid';
import { Inbox, type InboxMessage } from '@/components/Inbox';
// ENSIdentityModal removed from viewer flow
import { PaymentModal } from '@/components/PaymentModal';
import { WalletConnect } from '@/components/WalletConnect';
import { RoomView } from '@/components/RoomView';
import { MobileDrawer } from '@/components/MobileDrawer';
import { GoLiveModal } from '@/components/GoLiveModal';
import { SEED_ROOMS, type LiveRoom } from '@/lib/data/seed-rooms';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { getENSVerification } from '@/lib/storage/ens-store';

export default function Home() {
  const metamask = useMetaMask();
  
  // Auth state
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [verifiedEnsName, setVerifiedEnsName] = useState<string>('');
  const [needsWalletConnect, setNeedsWalletConnect] = useState(false);

  // UI state
  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [activeRoom, setActiveRoom] = useState<{ room: LiveRoom; credential: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [goLiveModalOpen, setGoLiveModalOpen] = useState(false);
  
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

  // Identity handlers removed - viewers use wallet address only

  const handleConnectClick = () => {
    setNeedsWalletConnect(true);
  };

  const handleRoomSelect = (room: LiveRoom) => {
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      setSelectedRoom(room);
      return;
    }

    // Viewer flow: skip ENS/identity - wallet address is enough
    // Go directly to payment
    setSelectedRoom(room);
    setCurrentEnsForPayment(room.host);
    setPaymentModalOpen(true);
  };

  // ENS verification handlers removed - not needed for viewer flow

  const handlePayment = async (): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    if (!selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    // Get host's meta-address (from registry or demo)
    const { getDemoHostMetaAddress } = await import('@/lib/demo/host-meta-addresses');
    const { getProtocolAdapter } = await import('@/lib/protocol/adapters');
    
    let hostMeta;
    try {
      const adapter = getProtocolAdapter();
      hostMeta = await adapter.getMetaAddress(selectedRoom.host);
    } catch (e) {
      // Fallback to demo meta-address if registry lookup fails
      hostMeta = null;
    }
    
    if (!hostMeta) {
      // Use deterministic demo meta-address for seed hosts
      hostMeta = getDemoHostMetaAddress(selectedRoom.host);
    }

    // Generate stealth address for the HOST (not viewer)
    const stealthPayment = generateStealthAddress(hostMeta);
    const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');

    // Send real payment on Sepolia
    const txHash = await sendEthTransaction(
      metamask.address,
      stealthAddressHex,
      '0.01'
    );

    // Wait for confirmation
    await waitForTransactionReceipt(txHash);

    return { 
      txHash, 
      sharedSecret: stealthPayment.sharedSecret 
    };
  };

  const handlePaymentSuccess = async (txHash: string, sharedSecret: Uint8Array) => {
    if (!selectedRoom) return;

    // Derive room credential from ECDH shared secret
    const { deriveAccessCredential } = await import('@/lib/crypto/credentials');
    const roomCredential = deriveAccessCredential(sharedSecret);

    const message: InboxMessage = {
      id: `msg-${Date.now()}`,
      roomId: selectedRoom.id,
      roomTitle: selectedRoom.title,
      encryptedPassword: roomCredential,
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

    // Find the room
    const room = SEED_ROOMS.find(r => r.id === message.roomId);
    if (room) {
      setActiveRoom({
        room,
        credential: message.encryptedPassword
      });
      setInboxOpen(false);
    }
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
  };

  const handleGoLive = () => {
    // Check if connected
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      return;
    }
    // Go Live modal will handle ENS verification
    setGoLiveModalOpen(true);
  };

  const handleStartStream = (title: string, category: string) => {
    // Create a host room and start streaming
    const hostRoom: LiveRoom = {
      id: `host-${Date.now()}`,
      host: metamask.address || '',
      hostDisplayName: verifiedEnsName || `Host ${metamask.address?.slice(0,6)}`,
      title,
      category,
      viewers: 1,
      tags: [category, 'Live'],
      isFeatured: false,
      isDemoSeed: false,
      thumbnail: '',
      isLive: true
    };
    
    setGoLiveModalOpen(false);
    setActiveRoom({ room: hostRoom, credential: 'host-stream' });
  };

  return (
    <NetworkGuard>
      <div style={{ backgroundColor: 'var(--base)', minHeight: '100vh' }}>
        {/* Top Nav */}
        <TopNav
          isConnected={metamask.isConnected}
          address={metamask.address}
          verifiedEnsName={verifiedEnsName}
          onConnect={handleConnectClick}
          onMenuToggle={() => setMobileDrawerOpen(true)}
          onGoLive={() => setGoLiveModalOpen(true)}
        />

        {/* Left Rail - Desktop only */}
        <LeftRail
          rooms={SEED_ROOMS}
          onSelectRoom={handleRoomSelect}
        />

        {/* Mobile Drawer */}
        <MobileDrawer
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          rooms={SEED_ROOMS}
          onSelectRoom={handleRoomSelect}
        />

        {/* Main Content */}
        <main
          className="main-content"
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

        {/* ENS Identity Modal - REMOVED for viewers (wallet address is enough) */}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={paymentModalOpen}
          room={selectedRoom}
          ensName={verifiedEnsName || undefined}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedRoom(null);
          }}
          onPay={handlePayment}
          onSuccess={handlePaymentSuccess}
        />

        {/* Room View (WebRTC Stream) */}
        {activeRoom && (
          <RoomView
            room={activeRoom.room}
            roomCredential={activeRoom.credential}
            onLeave={handleLeaveRoom}
            isHost={activeRoom.credential === 'host-stream'}
          />
        )}

        {/* Go Live Modal */}
        <GoLiveModal
          isOpen={goLiveModalOpen}
          ensName={verifiedEnsName}
          metaAddress={metaAddress}
          walletAddress={metamask.address || ''}
          onClose={() => setGoLiveModalOpen(false)}
          onStartStream={handleStartStream}
        />

        {/* Wallet Connect Overlay */}
        {needsWalletConnect && (
          <WalletConnect onIdentityReady={() => setNeedsWalletConnect(false)} />
        )}
      </div>
    </NetworkGuard>
  );
}
