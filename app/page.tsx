'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { NetworkGuard } from '@/components/NetworkGuard';
import { AppShell } from '@/components/AppShell';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { LiveGrid } from '@/components/LiveGrid';
import { CategoryShelf } from '@/components/CategoryShelf';
import { Inbox, type InboxMessage } from '@/components/Inbox';
import { ENSIdentityModal } from '@/components/ENSIdentityModal';
import { PaymentModal } from '@/components/PaymentModal';
import { WalletConnect } from '@/components/WalletConnect';
import { RoomView } from '@/components/RoomView';
import { GoLiveModal } from '@/components/GoLiveModal';
import { SEED_ROOMS, getCategoryStats, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { storeENSVerification, getENSVerification } from '@/lib/storage/ens-store';
import type { CategoryItem } from '@/components/ui/CategoryCard';

const SIDEBAR_KEY = 'stellarcast-sidebar-collapsed';

export default function Home() {
  const metamask = useMetaMask();

  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [verifiedEnsName, setVerifiedEnsName] = useState<string>('');
  const [needsWalletConnect, setNeedsWalletConnect] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [ensModalOpen, setEnsModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [activeRoom, setActiveRoom] = useState<{ room: LiveRoom; credential: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [goLiveModalOpen, setGoLiveModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [currentEnsForPayment, setCurrentEnsForPayment] = useState('');
  const featuredRoom = SEED_ROOMS.find((r) => r.isFeatured) || SEED_ROOMS[0];

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SIDEBAR_KEY);
      if (stored === '1') setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

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

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SEED_ROOMS.filter((room) => {
      if (categoryFilter && room.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        room.title.toLowerCase().includes(q) ||
        room.category.toLowerCase().includes(q) ||
        room.tags.some((t) => t.toLowerCase().includes(q)) ||
        (room.hostDisplayName || '').toLowerCase().includes(q) ||
        room.host.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, categoryFilter]);

  const categories = useMemo(() => getCategoryStats(SEED_ROOMS), []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    if (metamask.address) {
      await storeENSVerification({
        walletAddress: metamask.address,
        ensName,
        chainId: 11155111,
        message,
        signature,
        verifiedAt: new Date().toISOString(),
      });
      setVerifiedEnsName(ensName);
    }

    setCurrentEnsForPayment(ensName);
    setEnsModalOpen(false);

    setTimeout(() => {
      setPaymentModalOpen(true);
    }, 300);
  };

  const handlePayment = async (): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    if (!identity || !selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    const { getDemoHostMetaAddress } = await import('@/lib/demo/host-meta-addresses');
    const { getProtocolAdapter } = await import('@/lib/protocol/adapters');

    let hostMeta;
    try {
      const adapter = getProtocolAdapter();
      hostMeta = await adapter.getMetaAddress(selectedRoom.host);
    } catch {
      hostMeta = null;
    }

    if (!hostMeta) {
      hostMeta = getDemoHostMetaAddress(selectedRoom.host);
    }

    const stealthPayment = generateStealthAddress(hostMeta);
    const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');

    const txHash = await sendEthTransaction(metamask.address, stealthAddressHex, '0.01');

    await waitForTransactionReceipt(txHash);

    return {
      txHash,
      sharedSecret: stealthPayment.sharedSecret,
    };
  };

  const handlePaymentSuccess = async (_txHash: string, sharedSecret: Uint8Array) => {
    if (!selectedRoom) return;

    const { deriveAccessCredential } = await import('@/lib/crypto/credentials');
    const roomCredential = deriveAccessCredential(sharedSecret);

    const message: InboxMessage = {
      id: `msg-${Date.now()}`,
      roomId: selectedRoom.id,
      roomTitle: selectedRoom.title,
      encryptedPassword: roomCredential,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    setInboxMessages((prev) => [message, ...prev]);
    setPaymentModalOpen(false);

    setTimeout(() => {
      setInboxOpen(true);
    }, 500);
  };

  const handleUsePassword = (message: InboxMessage) => {
    setInboxMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m)));

    const room = SEED_ROOMS.find((r) => r.id === message.roomId);
    if (room) {
      setActiveRoom({
        room,
        credential: message.encryptedPassword,
      });
      setInboxOpen(false);
    }
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
  };

  const handleGoLive = () => {
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      return;
    }
    if (!identity) {
      setNeedsWalletConnect(true);
      return;
    }
    setGoLiveModalOpen(true);
  };

  const handleStartStream = (title: string, category: string) => {
    const hostRoom: LiveRoom = {
      id: `host-${Date.now()}`,
      host: metamask.address || '',
      hostDisplayName: verifiedEnsName || `Host ${metamask.address?.slice(0, 6)}`,
      title,
      category,
      viewers: 1,
      tags: [category, 'Live'],
      isFeatured: false,
      isDemoSeed: false,
      thumbnail: '',
      isLive: true,
    };

    setGoLiveModalOpen(false);
    setActiveRoom({ room: hostRoom, credential: 'host-stream' });
  };

  const handleSelectCategory = (category: CategoryItem) => {
    setCategoryFilter(category.name);
    setSearchQuery('');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter(null);
  };

  const unreadCount = inboxMessages.filter((m) => !m.isRead).length;
  const showFeatured = !searchQuery && !categoryFilter;

  return (
    <NetworkGuard>
      <AppShell
        rooms={SEED_ROOMS}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        mobileDrawerOpen={mobileDrawerOpen}
        onMobileDrawerChange={setMobileDrawerOpen}
        onSelectRoom={handleRoomSelect}
        searchQuery={searchQuery}
        onSearchChange={(v) => {
          setSearchQuery(v);
          if (v) setCategoryFilter(null);
        }}
        isConnected={metamask.isConnected}
        address={metamask.address}
        verifiedEnsName={verifiedEnsName}
        unreadCount={unreadCount}
        onConnect={handleConnectClick}
        onGoLive={handleGoLive}
        onInboxToggle={() => setInboxOpen((v) => !v)}
        onBrowse={clearFilters}
        inboxOpen={inboxOpen}
      >
        {showFeatured && <FeaturedCarousel room={featuredRoom} onJoin={handleRoomSelect} />}

        <LiveGrid
          rooms={filteredRooms}
          onSelectRoom={handleRoomSelect}
          title={
            categoryFilter
              ? `${categoryFilter}`
              : searchQuery
                ? `Results for “${searchQuery}”`
                : 'Live now'
          }
          emptyTitle="No streams match"
          emptyDescription="Adjust your search or browse all live channels."
          onClearFilters={clearFilters}
        />

        {showFeatured && (
          <CategoryShelf categories={categories} onSelectCategory={handleSelectCategory} />
        )}
      </AppShell>

      <Inbox
        messages={inboxMessages}
        isOpen={inboxOpen}
        onToggle={() => setInboxOpen(!inboxOpen)}
        onUsePassword={handleUsePassword}
      />

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

      {activeRoom && (
        <RoomView
          room={activeRoom.room}
          roomCredential={activeRoom.credential}
          onLeave={handleLeaveRoom}
        />
      )}

      <GoLiveModal
        isOpen={goLiveModalOpen}
        ensName={verifiedEnsName}
        metaAddress={metaAddress}
        onClose={() => setGoLiveModalOpen(false)}
        onStartStream={handleStartStream}
      />

      {needsWalletConnect && <WalletConnect onIdentityReady={handleIdentityReady} />}
    </NetworkGuard>
  );
}
