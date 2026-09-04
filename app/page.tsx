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
import { getCategoryStats, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { generateStealthAddress } from '@/lib/crypto/stealth';
import { sendEthTransaction, waitForTransactionReceipt } from '@/lib/blockchain/transactions';
import { getENSVerification, storeENSVerification } from '@/lib/storage/ens-store';
import type { CategoryItem } from '@/components/ui/CategoryCard';
import {
  checkReceivingStatus,
  type ReceivingStatus,
} from '@/lib/stealth/receiving';
import { useRooms } from '@/lib/hooks/useRooms';

const SIDEBAR_KEY = 'stellarcast-sidebar-collapsed';
const ENTRY_PRICE_ETH = '0.001';

export default function Home() {
  const metamask = useMetaMask();
  const previousAddressRef = useRef<string | null>(null);
  const { rooms, loading: roomsLoading, reload: reloadRooms } = useRooms();

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

  const featuredRoom = rooms.find((r) => r.isFeatured) || rooms[0] || null;

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

    // NFT rooms should have stealthMetaAddress in metadata; fall back to that
    if (!hostMeta && selectedRoom.stealthMetaAddress) {
      console.log('Using stealthMetaAddress from room NFT metadata');
      hostMeta = selectedRoom.stealthMetaAddress;
    }

    if (!hostMeta) {
      throw new Error('This host has not registered a stealth receiving address yet. They need to set up receiving in Go Live first.');
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

    try {
      // Derive password from stealth payment shared secret
      const { deriveRoomPassword, decryptRoomAccess, unpackEncryptedData } = 
        await import('@/lib/crypto/room-access');
      const { getEncryptedAccessData } = await import('@/lib/blockchain/rooms-contract');
      
      const password = await deriveRoomPassword(sharedSecret);
      
      // Extract room token ID from room.id (format: "room-{tokenId}")
      const tokenId = parseInt(selectedRoom.id.replace('room-', ''));
      
      // Fetch encrypted access data from chain
      const encryptedPackage = await getEncryptedAccessData(tokenId);
      
      if (!encryptedPackage) {
        throw new Error('Room access data not found');
      }
      
      // Unpack and decrypt
      const unpacked = unpackEncryptedData(encryptedPackage);
      if (!unpacked) {
        throw new Error('Invalid encrypted data format');
      }
      
      const accessCredentials = await decryptRoomAccess(unpacked.encrypted, unpacked.iv, password);
      
      if (!accessCredentials) {
        throw new Error('Failed to decrypt room access');
      }
      
      // Store decrypted credentials in inbox
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
      
      console.log('Room access unlocked:', accessCredentials);
    } catch (error) {
      console.error('Failed to unlock room access:', error);
      alert('Payment succeeded but failed to decrypt room access. See console for details.');
      setPaymentModalOpen(false);
    }
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
    if (!metamask.address || !verifiedEnsName || !metaAddress) {
      console.error('Missing required data for room creation');
      return;
    }

    try {
      // Generate room access credentials (for hackathon: stub WebRTC data)
      const { generateDemoRoomCredentials, encryptRoomAccess, deriveRoomPassword, packageEncryptedData } = 
        await import('@/lib/crypto/room-access');
      const { createRoomOnChain } = await import('@/lib/blockchain/rooms-contract');
      
      const roomCredentials = generateDemoRoomCredentials(title, verifiedEnsName);
      
      // Derive password from a random shared secret (in production, viewers derive this from stealth payment)
      const randomSecret = crypto.getRandomValues(new Uint8Array(32));
      const password = await deriveRoomPassword(randomSecret);
      
      // Encrypt access data
      const { encrypted, iv } = await encryptRoomAccess(roomCredentials, password);
      const encryptedData = packageEncryptedData(encrypted, iv);
      
      // Mint room NFT on-chain
      const tags = [category, 'Live', 'Privacy'];
      const { txHash } = await createRoomOnChain(metamask.address, {
        hostEns: verifiedEnsName,
        title,
        category,
        tags,
        stealthMetaAddress: metaAddress,
        thumbnail: '',
        entryPrice: ENTRY_PRICE_ETH,
        encryptedAccessData: encryptedData,
      });

      console.log('Room NFT minted:', txHash);

      // Create local room for immediate host view
      const hostRoom: LiveRoom = {
        id: `room-${Date.now()}`,
        host: metamask.address,
        hostDisplayName: verifiedEnsName,
        title,
        category,
        viewers: 1,
        tags,
        isFeatured: false,
        thumbnail: '',
        isLive: true,
        createdAt: Date.now(),
        stealthMetaAddress: metaAddress,
      };

      setGoLiveModalOpen(false);
      setActiveRoom({ room: hostRoom, credential: 'host-stream' });
      
      // Reload rooms to show newly created room for other viewers
      setTimeout(() => {
        reloadRooms();
      }, 3000);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room. Make sure Room contract is deployed. See console for details.');
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
        onSetupReceiving={handleSetupReceiving}
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
