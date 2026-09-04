'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { NetworkGuard } from '@/components/NetworkGuard';
import { AppShell } from '@/components/AppShell';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { LiveGrid } from '@/components/LiveGrid';
import { CategoryShelf } from '@/components/CategoryShelf';
import { Inbox, type InboxMessage } from '@/components/Inbox';
import { PaymentModal } from '@/components/PaymentModal';
import { WalletConnect } from '@/components/WalletConnect';
import { RoomView } from '@/components/RoomView';
import { GoLiveModal } from '@/components/GoLiveModal';
import { ViewStealthAddressModal } from '@/components/ViewStealthAddressModal';
import { getCategoryStats, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { generateStealthAddress, encodeNativeEthMetadata, entryPriceToWei } from '@/lib/crypto/stealth';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { getENSVerification, storeENSVerification } from '@/lib/storage/ens-store';
import type { CategoryItem } from '@/components/ui/CategoryCard';
import {
  checkReceivingStatus,
  resolveHostStealthMetaAddress,
  type ReceivingStatus,
} from '@/lib/stealth/receiving';
import { replaceStoredIdentity, clearSessionWrapKey } from '@/lib/storage/identity-store';
import { deriveAccessCredential } from '@/lib/crypto/credentials';
import { encodeMetaAddress, identityToMetaAddress } from '@/lib/crypto/identity';
import { useRooms } from '@/lib/hooks/useRooms';

const SIDEBAR_KEY = 'stellarcast-sidebar-collapsed';
const ENTRY_PRICE_ETH = '0.001';

export default function Home() {
  const metamask = useMetaMask();
  const previousAddressRef = useRef<string | null>(null);
  const { rooms, loading: roomsLoading, reload: reloadRooms, upsertRoom } = useRooms();

  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [verifiedEnsName, setVerifiedEnsName] = useState<string>('');
  const [needsWalletConnect, setNeedsWalletConnect] = useState(false);
  const [receivingStatus, setReceivingStatus] = useState<ReceivingStatus>('idle');
  const [receivingMessage, setReceivingMessage] = useState('');
  const [viewStealthOpen, setViewStealthOpen] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [activeRoom, setActiveRoom] = useState<{ room: LiveRoom; credential: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [goLiveModalOpen, setGoLiveModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const identityRef = useRef<StealthIdentity | null>(null);

  const featuredRoom = rooms.find((r) => r.isFeatured) || rooms[0] || null;

  const clearSessionForAccountChange = () => {
    setIdentity(null);
    setMetaAddress('');
    setVerifiedEnsName('');
    setReceivingStatus('idle');
    setReceivingMessage('');
    setViewStealthOpen(false);
    setGoLiveModalOpen(false);
    setPaymentModalOpen(false);
    setSelectedRoom(null);
    setActiveRoom(null);
    setInboxOpen(false);
    // Keep inboxMessages — they are local credentials; clearing is safer on account switch
    setInboxMessages([]);
    identityRef.current = null;
    clearSessionWrapKey();
  };

  // Initialize protocol adapter for live Sepolia mode
  useEffect(() => {
    const initProtocol = async () => {
      const { setProtocolAdapter, LiveProtocolAdapter } = await import('@/lib/protocol/adapters');
      const { KNOWN_CONTRACTS, SEPOLIA_CHAIN_ID } = await import('@/lib/blockchain/contracts');
      
      const contracts = KNOWN_CONTRACTS[SEPOLIA_CHAIN_ID];
      if (contracts.registry && contracts.announcer) {
        const liveAdapter = new LiveProtocolAdapter(
          SEPOLIA_CHAIN_ID,
          contracts.registry,
          contracts.announcer
        );
        setProtocolAdapter(liveAdapter);
        console.log('Initialized live protocol adapter for Sepolia');
      }
    };
    
    initProtocol();
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SIDEBAR_KEY);
      if (stored === '1') setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  // Reset app session when MetaMask account changes or disconnects
  useEffect(() => {
    const next = metamask.address?.toLowerCase() || null;
    const prev = previousAddressRef.current;

    if (prev && next && prev !== next) {
      clearSessionForAccountChange();
    } else if (prev && !next) {
      clearSessionForAccountChange();
      setNeedsWalletConnect(false);
    }

    previousAddressRef.current = next;
  }, [metamask.address]);

  useEffect(() => {
    const checkExistingENS = async () => {
      if (metamask.isConnected && metamask.address) {
        const existing = await getENSVerification(metamask.address);
        if (existing) {
          setVerifiedEnsName(existing.ensName);
        } else {
          setVerifiedEnsName('');
        }
      } else {
        setVerifiedEnsName('');
      }
    };
    checkExistingENS();
  }, [metamask.isConnected, metamask.address]);

  const refreshReceivingStatus = async (
    wallet: string,
    userIdentity: StealthIdentity,
    ensOverride?: string
  ) => {
    setReceivingStatus('checking');
    const result = await checkReceivingStatus(
      wallet,
      userIdentity,
      ensOverride ?? (verifiedEnsName || undefined)
    );
    setReceivingStatus(result.status);
    setReceivingMessage(result.message || '');
    if (result.localMetaEncoded) {
      setMetaAddress(result.localMetaEncoded);
    }
    return result;
  };

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => {
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
  }, [rooms, searchQuery, categoryFilter]);

  const categories = useMemo(() => getCategoryStats(rooms), [rooms]);

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

  const handleWalletConnected = () => {
    setNeedsWalletConnect(false);
    if (selectedRoom) {
      setPaymentModalOpen(true);
    }
  };

  const handleEnsResolved = async (ensName: string) => {
    if (metamask.address) {
      await storeENSVerification({
        walletAddress: metamask.address,
        ensName,
        chainId: 11155111,
        message: `resolved ${ensName}`,
        signature: '',
        verifiedAt: new Date().toISOString(),
      });
    }
    setVerifiedEnsName(ensName);
    const hostIdentity = identityRef.current || identity;
    if (metamask.address && hostIdentity) {
      await refreshReceivingStatus(metamask.address, hostIdentity, ensName);
    }
  };

  const handleConnectClick = () => {
    setNeedsWalletConnect(true);
  };

  const handleSwitchAccount = async () => {
    const ok = await metamask.switchAccount();
    // Session reset + re-auth are handled by the address-change effect
    if (!ok && metamask.address) {
      // User cancelled — stay on current account
      return;
    }
  };

  const handleDisconnect = async () => {
    await metamask.disconnect();
    clearSessionForAccountChange();
    setNeedsWalletConnect(false);
  };

  const handleViewStealthAddress = () => {
    setViewStealthOpen(true);
  };

  const handleRoomSelect = (room: LiveRoom) => {
    setSelectedRoom(room);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    if (!selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    const { getProtocolAdapter } = await import('@/lib/protocol/adapters');
    const adapter = getProtocolAdapter();

    const hostEnsName = selectedRoom.hostDisplayName?.endsWith('.eth')
      ? selectedRoom.hostDisplayName
      : null;

    const hostMeta = await resolveHostStealthMetaAddress({
      ensName: hostEnsName,
      encodedMeta: selectedRoom.stealthMetaAddress,
    });

    if (!hostMeta) {
      throw new Error(
        'This host has no stealth-meta-address[1] on ENS. They need to finish Go Live first.'
      );
    }

    const stealthPayment = generateStealthAddress(hostMeta);
    const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');
    const ephemeralPubKeyHex = '0x' + Buffer.from(stealthPayment.ephemeralPublicKey).toString('hex');
    const metadata = encodeNativeEthMetadata(
      stealthPayment.viewTag,
      entryPriceToWei(ENTRY_PRICE_ETH)
    );

    if (adapter.mode === 'live') {
      const announceTxHash = await adapter.publishAnnouncement(
        BigInt(1),
        stealthAddressHex,
        ephemeralPubKeyHex,
        metadata,
        stealthPayment.viewTag
      );
      await waitForTransactionReceipt(announceTxHash);
    }

    const txHash = await sendEthTransaction(metamask.address, stealthAddressHex, ENTRY_PRICE_ETH);
    await waitForTransactionReceipt(txHash);

    return {
      txHash,
      sharedSecret: stealthPayment.sharedSecret,
    };
  };

  const handlePaymentSuccess = async (_txHash: string, sharedSecret: Uint8Array) => {
    if (!selectedRoom) return;

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

    const room = rooms.find((r) => r.id === message.roomId);
    if (room) {
      setActiveRoom({
        room,
        credential: message.encryptedPassword,
      });
      setInboxOpen(false);
    }
  };

  const handleLeaveRoom = async () => {
    const session = activeRoom;
    if (!session) return;

    if (session.credential === 'host-stream' && metamask.address) {
      const confirmed = window.confirm(
        'End this livestream? The listing will leave Browse. If you cancel the wallet transaction, the room stays live.'
      );
      if (!confirmed) return;

      const { parseRoomTokenId, updateRoomStatusOnChain } = await import('@/lib/blockchain/rooms-contract');
      const tokenId = parseRoomTokenId(session.room.id);
      if (tokenId === undefined) {
        setActiveRoom(null);
        void reloadRooms();
        return;
      }

      try {
        await updateRoomStatusOnChain(metamask.address, tokenId, false);
        upsertRoom({ ...session.room, isLive: false });
        setActiveRoom(null);
        void reloadRooms();
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.toLowerCase().includes('reject') || message.toLowerCase().includes('denied')) {
          return;
        }
        window.alert(message || 'Could not end the livestream on-chain. The listing may still be live.');
      }
      return;
    }

    setActiveRoom(null);
  };

  const handleGoLive = () => {
    setGoLiveModalOpen(true);
  };

  const handleKeysUpdated = async (nextIdentity: StealthIdentity, encoded: string) => {
    identityRef.current = nextIdentity;
    setIdentity(nextIdentity);
    setMetaAddress(encoded);
    if (metamask.address) {
      try {
        await replaceStoredIdentity(nextIdentity, metamask.address);
      } catch (err) {
        console.warn('Could not persist stealth keys to IndexedDB:', err);
      }
      await refreshReceivingStatus(metamask.address, nextIdentity, verifiedEnsName || undefined);
    }
  };

  const handleStartStream = async (title: string, category: string, ensName: string) => {
    const hostIdentity = identityRef.current || identity;
    if (!metamask.address || !ensName || !hostIdentity) {
      throw new Error('Connect a wallet, resolve ENS, and load payment keys before creating a room');
    }

    const { createRoomOnChain } = await import('@/lib/blockchain/rooms-contract');
    const tags = [category, 'Live', 'Privacy'];
    const encodedMeta = encodeMetaAddress(identityToMetaAddress(hostIdentity));

    const { txHash, tokenId, blockNumber } = await createRoomOnChain(metamask.address, {
      hostEns: ensName,
      title,
      category,
      tags,
      stealthMetaAddress: encodedMeta,
      thumbnail: '',
      entryPrice: ENTRY_PRICE_ETH,
      encryptedAccessData: '0x',
    });

    console.log('Room created:', txHash, tokenId, blockNumber);

    const hostRoom: LiveRoom = {
      id: tokenId ? `room-${tokenId}` : `room-${Date.now()}`,
      host: metamask.address,
      hostDisplayName: ensName,
      title,
      category,
      viewers: 1,
      tags,
      isFeatured: false,
      thumbnail: '',
      isLive: true,
      createdAt: Date.now(),
      createdBlock: blockNumber,
      stealthMetaAddress: encodedMeta,
    };

    setVerifiedEnsName(ensName);
    setGoLiveModalOpen(false);
    upsertRoom(hostRoom);
    setActiveRoom({ room: hostRoom, credential: 'host-stream' });
    void reloadRooms();
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
        rooms={rooms}
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
        receivingStatus={receivingStatus}
        isSwitchingAccount={metamask.isSwitching}
        onConnect={handleConnectClick}
        onGoLive={handleGoLive}
        onInboxToggle={() => setInboxOpen((v) => !v)}
        onBrowse={clearFilters}
        onViewStealthAddress={handleViewStealthAddress}
        onSwitchAccount={handleSwitchAccount}
        onDisconnect={handleDisconnect}
        inboxOpen={inboxOpen}
      >
        {showFeatured && featuredRoom && <FeaturedCarousel room={featuredRoom} onJoin={handleRoomSelect} />}

        <LiveGrid
          rooms={filteredRooms}
          onSelectRoom={handleRoomSelect}
          loading={roomsLoading}
          title={
            categoryFilter
              ? `${categoryFilter}`
              : searchQuery
                ? `Results for “${searchQuery}”`
                : 'Live now'
          }
          emptyTitle={roomsLoading ? 'Loading rooms...' : 'No live rooms yet'}
          emptyDescription={roomsLoading ? 'Fetching rooms from Sepolia...' : 'Be the first to Go Live and create a room!'}
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

      <PaymentModal
        isOpen={paymentModalOpen}
        room={selectedRoom}
        ensName={verifiedEnsName || undefined}
        isWalletConnected={metamask.isConnected}
        isConnecting={metamask.isConnecting}
        onConnectWallet={metamask.connect}
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
          isHost={activeRoom.credential === 'host-stream'}
          hostIdentity={identity}
          onPaymentDetected={(payment) => {
            console.log('Host detected payment:', payment);
            // Payment automatically has the shared secret which = access credential
            // Viewer already has this from their payment flow
          }}
        />
      )}

      <GoLiveModal
        isOpen={goLiveModalOpen}
        ensName={verifiedEnsName}
        metaAddress={metaAddress}
        walletAddress={metamask.address || ''}
        identity={identity}
        isConnecting={metamask.isConnecting}
        onConnectWallet={metamask.connect}
        onClose={() => setGoLiveModalOpen(false)}
        onStartStream={handleStartStream}
        onEnsResolved={handleEnsResolved}
        onKeysUpdated={handleKeysUpdated}
      />

      <ViewStealthAddressModal
        isOpen={viewStealthOpen}
        metaAddress={metaAddress}
        walletAddress={metamask.address || ''}
        receivingStatus={receivingStatus}
        onClose={() => setViewStealthOpen(false)}
      />

      {needsWalletConnect && (
        <WalletConnect
          onConnected={handleWalletConnected}
          onDismiss={() => setNeedsWalletConnect(false)}
        />
      )}
    </NetworkGuard>
  );
}
