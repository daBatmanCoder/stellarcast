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
import { StealthSetupModal } from '@/components/StealthSetupModal';
import { ViewStealthAddressModal } from '@/components/ViewStealthAddressModal';
import { SEED_ROOMS, getCategoryStats, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { getENSVerification, storeENSVerification } from '@/lib/storage/ens-store';
import type { CategoryItem } from '@/components/ui/CategoryCard';
import {
  checkReceivingStatus,
  type ReceivingStatus,
} from '@/lib/stealth/receiving';

const SIDEBAR_KEY = 'stellarcast-sidebar-collapsed';
const ENTRY_PRICE_ETH = '0.001';

export default function Home() {
  const metamask = useMetaMask();
  const previousAddressRef = useRef<string | null>(null);

  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [metaAddress, setMetaAddress] = useState<string>('');
  const [verifiedEnsName, setVerifiedEnsName] = useState<string>('');
  const [needsWalletConnect, setNeedsWalletConnect] = useState(false);
  const [receivingStatus, setReceivingStatus] = useState<ReceivingStatus>('idle');
  const [receivingMessage, setReceivingMessage] = useState('');
  const [stealthSetupOpen, setStealthSetupOpen] = useState(false);
  const [viewStealthOpen, setViewStealthOpen] = useState(false);
  const [pendingGoLive, setPendingGoLive] = useState(false);

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

  const featuredRoom = SEED_ROOMS.find((r) => r.isFeatured) || SEED_ROOMS[0];

  const clearSessionForAccountChange = () => {
    setIdentity(null);
    setMetaAddress('');
    setVerifiedEnsName('');
    setReceivingStatus('idle');
    setReceivingMessage('');
    setStealthSetupOpen(false);
    setViewStealthOpen(false);
    setPendingGoLive(false);
    setGoLiveModalOpen(false);
    setPaymentModalOpen(false);
    setSelectedRoom(null);
    setActiveRoom(null);
    setInboxOpen(false);
    // Keep inboxMessages — they are local credentials; clearing is safer on account switch
    setInboxMessages([]);
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
      setNeedsWalletConnect(true);
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

  const refreshReceivingStatus = async (wallet: string, userIdentity: StealthIdentity) => {
    setReceivingStatus('checking');
    const result = await checkReceivingStatus(wallet, userIdentity);
    setReceivingStatus(result.status);
    setReceivingMessage(result.message || '');
    if (result.localMetaEncoded) {
      setMetaAddress(result.localMetaEncoded);
    }
    return result;
  };

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

  const handleIdentityReady = async (
    userIdentity: StealthIdentity,
    userMetaAddress: string,
    ensName?: string
  ) => {
    setIdentity(userIdentity);
    setMetaAddress(userMetaAddress);
    if (ensName) {
      setVerifiedEnsName(ensName);
    }
    setNeedsWalletConnect(false);

    if (metamask.address) {
      const result = await refreshReceivingStatus(metamask.address, userIdentity);
      // Soft prompt for hosts who need setup — don't block viewers
      if (result.status === 'needs-setup' || result.status === 'keys-mismatch') {
        // Only auto-open setup if they were trying to go live
        if (pendingGoLive) {
          setStealthSetupOpen(true);
        }
      } else if (result.status === 'ready' && pendingGoLive) {
        setPendingGoLive(false);
        setGoLiveModalOpen(true);
      }
    }

    // Viewer path: continue to payment after connect
    if (selectedRoom) {
      setPaymentModalOpen(true);
    }
  };

  const handleHostEnsVerified = async (ensName: string, signature: string, message: string) => {
    if (metamask.address) {
      await storeENSVerification({
        walletAddress: metamask.address,
        ensName,
        chainId: 11155111,
        message,
        signature,
        verifiedAt: new Date().toISOString(),
      });
    }
    setVerifiedEnsName(ensName);
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

  const handleSetupReceiving = () => {
    if (!metamask.isConnected || !identity) {
      setNeedsWalletConnect(true);
      return;
    }
    setStealthSetupOpen(true);
  };

  const handleViewStealthAddress = () => {
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      return;
    }
    if (!identity || !metaAddress) {
      setNeedsWalletConnect(true);
      return;
    }
    setViewStealthOpen(true);
  };

  const handleRoomSelect = (room: LiveRoom) => {
    if (!metamask.isConnected) {
      setNeedsWalletConnect(true);
      setSelectedRoom(room);
      return;
    }

    // Viewer flow: wallet address is enough — no stealth registration required
    setSelectedRoom(room);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    if (!selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    const { getDemoHostMetaAddress } = await import('@/lib/demo/host-meta-addresses');
    const { getProtocolAdapter } = await import('@/lib/protocol/adapters');

    // Get the protocol adapter (should be live mode for real payments)
    const adapter = getProtocolAdapter();
    
    let hostMeta;
    let hostEnsName: string | null = null;
    
    // Try to resolve ENS and get stealth meta-address
    try {
      // First try to get ENS name from hostDisplayName or reverse lookup
      if (selectedRoom.hostDisplayName?.endsWith('.eth')) {
        hostEnsName = selectedRoom.hostDisplayName;
        // Verify it resolves to the host address
        const resolvedAddr = await adapter.resolveENS(hostEnsName);
        if (resolvedAddr?.toLowerCase() !== selectedRoom.host.toLowerCase()) {
          console.warn('ENS name does not match host address');
          hostEnsName = null;
        }
      }
      
      // Get stealth meta-address (adapter now checks ENS text records first)
      hostMeta = await adapter.getMetaAddress(selectedRoom.host);
    } catch (error) {
      console.error('Failed to get host stealth meta-address:', error);
      hostMeta = null;
    }

    // Seed/demo rooms may not be registered on-chain — fall back for those only
    if (!hostMeta) {
      if (selectedRoom.isDemoSeed) {
        console.log('Using demo meta-address for seed room');
        hostMeta = getDemoHostMetaAddress(selectedRoom.host);
      } else {
        throw new Error('This host has not registered a stealth receiving address yet. They need to set up receiving in Go Live first.');
      }
    }

    // Generate stealth address from host's meta-address
    const stealthPayment = generateStealthAddress(hostMeta);
    const stealthAddressHex = '0x' + Buffer.from(stealthPayment.stealthAddress).toString('hex');
    const ephemeralPubKeyHex = '0x' + Buffer.from(stealthPayment.ephemeralPublicKey).toString('hex');

    console.log('Generated stealth payment:', {
      stealthAddress: stealthAddressHex,
      ephemeralPubKey: ephemeralPubKeyHex,
      viewTag: stealthPayment.viewTag,
    });

    // Publish announcement to ERC-5564 contract (if live mode)
    try {
      if (adapter.mode === 'live') {
        const announceTxHash = await adapter.publishAnnouncement(
          BigInt(1), // scheme ID
          stealthAddressHex,
          ephemeralPubKeyHex,
          '0x', // metadata (empty for now)
          stealthPayment.viewTag
        );
        console.log('Published announcement:', announceTxHash);
      } else {
        console.log('Mock mode: skipping announcement publish');
      }
    } catch (error) {
      console.error('Failed to publish announcement (continuing with payment):', error);
      // Continue with payment even if announcement fails
    }

    // Send payment to the stealth address
    const txHash = await sendEthTransaction(metamask.address, stealthAddressHex, ENTRY_PRICE_ETH);
    console.log('Payment sent:', txHash);

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
    if (!metamask.isConnected || !identity) {
      setPendingGoLive(true);
      setNeedsWalletConnect(true);
      return;
    }

    if (receivingStatus !== 'ready') {
      setPendingGoLive(true);
      setStealthSetupOpen(true);
      return;
    }

    setGoLiveModalOpen(true);
  };

  const handleStealthRegistered = async (encoded: string, slot?: number) => {
    setMetaAddress(encoded);
    setReceivingStatus('ready');
    setReceivingMessage('Receiving ready — viewers can pay your stealth meta-address.');
    
    console.log(`Registered stealth meta-address${slot ? ` in slot [${slot}]` : ''}:`, encoded);

    if (metamask.address && identity) {
      await refreshReceivingStatus(metamask.address, identity);
    }

    if (pendingGoLive) {
      setPendingGoLive(false);
      setStealthSetupOpen(false);
      setGoLiveModalOpen(true);
    }
  };

  const handleStartStream = async (title: string, category: string) => {
    if (!metamask.address || !identity) {
      setGoLiveModalOpen(false);
      return;
    }

    try {
      // Generate secure room credential
      const { generateSecureCredential } = await import('@/lib/crypto/credentials');
      const roomCredential = generateSecureCredential('ROOM');

      // Derive encryption key from host's identity
      const hostKeyMaterial = new Uint8Array([
        ...identity.spendingPrivateKey,
        ...identity.viewingPrivateKey,
      ]);
      
      // Encrypt and package room access data
      const { encryptAndPackageRoomAccess } = await import('@/lib/crypto/room-access');
      const encryptedAccessData = await encryptAndPackageRoomAccess(
        roomCredential,
        hostKeyMaterial.slice(0, 32)
      );

      // Create room NFT on-chain
      const { createRoomOnChain } = await import('@/lib/blockchain/rooms');
      const { waitForTransactionReceipt } = await import('@/lib/blockchain/transactions');
      
      console.log('Creating room NFT...', { title, category, encryptedAccessData });
      
      const txHash = await createRoomOnChain(
        metamask.address,
        title,
        category,
        encryptedAccessData
      );

      console.log('Room creation transaction sent:', txHash);

      // Wait for confirmation
      const receipt = await waitForTransactionReceipt(txHash);
      console.log('Room NFT minted:', receipt);

      // Create local room object
      const hostRoom: LiveRoom = {
        id: `host-${Date.now()}`,
        host: metamask.address,
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
      setActiveRoom({ room: hostRoom, credential: roomCredential });
    } catch (error) {
      console.error('Failed to create room:', error);
      
      // Show user-friendly error
      let errorMessage = 'Failed to create room';
      if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          errorMessage = 'Transaction was rejected. Please try again.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas. Please add ETH to your wallet.';
        } else if (error.message.includes('not deployed')) {
          errorMessage = 'Room contract not found. Please check network connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage);
      // Keep modal open so user can retry
    }
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
        receivingStatus={receivingStatus}
        isSwitchingAccount={metamask.isSwitching}
        onConnect={handleConnectClick}
        onGoLive={handleGoLive}
        onInboxToggle={() => setInboxOpen((v) => !v)}
        onBrowse={clearFilters}
        onSetupReceiving={handleSetupReceiving}
        onViewStealthAddress={handleViewStealthAddress}
        onSwitchAccount={handleSwitchAccount}
        onDisconnect={handleDisconnect}
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
        onClose={() => setGoLiveModalOpen(false)}
        onStartStream={handleStartStream}
        onEnsVerified={handleHostEnsVerified}
      />

      <StealthSetupModal
        isOpen={stealthSetupOpen}
        walletAddress={metamask.address || ''}
        identity={identity}
        metaAddress={metaAddress}
        ensName={verifiedEnsName}
        initialStatus={receivingStatus === 'keys-mismatch' ? 'keys-mismatch' : 'needs-setup'}
        statusMessage={receivingMessage}
        onClose={() => {
          setStealthSetupOpen(false);
          setPendingGoLive(false);
        }}
        onRegistered={handleStealthRegistered}
      />

      <ViewStealthAddressModal
        isOpen={viewStealthOpen}
        metaAddress={metaAddress}
        walletAddress={metamask.address || ''}
        receivingStatus={receivingStatus}
        onClose={() => setViewStealthOpen(false)}
        onSetupReceiving={handleSetupReceiving}
      />

      {needsWalletConnect && (
        <WalletConnect
          onIdentityReady={handleIdentityReady}
          onDismiss={() => setNeedsWalletConnect(false)}
        />
      )}
    </NetworkGuard>
  );
}
