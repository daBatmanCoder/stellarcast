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
import { ModalShell } from '@/components/ModalShell';
import { Button } from '@/components/ui/Button';
import { getCategoryStats, type LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import {
  generateStealthAddress,
  encodeNativeEthMetadata,
  entryPriceToWei,
  type StealthPaymentKind,
} from '@/lib/crypto/stealth';
import { getENSVerification, storeENSVerification } from '@/lib/storage/ens-store';
import type { CategoryItem } from '@/components/ui/CategoryCard';
import {
  checkReceivingStatus,
  resolveHostStealthMetaAddress,
  type ReceivingStatus,
} from '@/lib/stealth/receiving';
import {
  replaceStoredIdentity,
  clearSessionWrapKey,
  loadIdentity,
  getAuthInfo,
  getSessionWrapKey,
  setSessionWrapKey,
} from '@/lib/storage/identity-store';
import { reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { deriveAccessCredential } from '@/lib/crypto/credentials';
import { encodeMetaAddress, identityToMetaAddress } from '@/lib/crypto/identity';
import { useRooms } from '@/lib/hooks/useRooms';
import {
  saveAccessTicket,
  getAccessTicket,
  listAccessTickets,
  type AccessTicket,
} from '@/lib/storage/rooms-store';
import { getRoomMetadata, parseRoomTokenId } from '@/lib/blockchain/rooms-contract';

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
  const [hostRooms, setHostRooms] = useState<LiveRoom[]>([]);
  const [appNotice, setAppNotice] = useState<{ title: string; body: string } | null>(null);
  const identityRef = useRef<StealthIdentity | null>(null);

  const ticketToInbox = (ticket: AccessTicket): InboxMessage => ({
    id: ticket.id,
    roomId: ticket.roomId,
    roomTitle: ticket.roomTitle,
    encryptedPassword: ticket.credential,
    timestamp: ticket.paidAt,
    isRead: true,
  });

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
    setInboxMessages([]);
    setHostRooms([]);
    setAppNotice(null);
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

  useEffect(() => {
    const wallet = metamask.address;
    if (!wallet) {
      setInboxMessages([]);
      setHostRooms([]);
      return;
    }

    let cancelled = false;
    const loadWalletData = async () => {
      try {
        const tickets = await listAccessTickets(wallet);
        if (!cancelled) setInboxMessages(tickets.map(ticketToInbox));
      } catch (err) {
        console.warn('Could not load access tickets:', err);
      }

      try {
        const { getRoomsByHost } = await import('@/lib/blockchain/rooms-contract');
        const owned = await getRoomsByHost(wallet);
        if (!cancelled) setHostRooms(owned);
      } catch (err) {
        console.warn('Could not load host rooms:', err);
      }
    };

    void loadWalletData();
    return () => {
      cancelled = true;
    };
  }, [metamask.address]);

  useEffect(() => {
    if (!paymentModalOpen || !selectedRoom || !metamask.address) return;
    let cancelled = false;
    void getAccessTicket(metamask.address, selectedRoom.id).then((ticket) => {
      if (!cancelled && ticket) {
        enterRoom(selectedRoom, ticket.credential);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [paymentModalOpen, selectedRoom, metamask.address]);

  useEffect(() => {
    if (!activeRoom || activeRoom.credential === 'host-stream' || !activeRoom.room.isLive) {
      return;
    }

    const roomId = activeRoom.room.id;
    const tokenId = parseRoomTokenId(roomId);
    if (tokenId === undefined) return;

    let cancelled = false;
    const checkEnded = async () => {
      try {
        const meta = await getRoomMetadata(tokenId);
        if (cancelled || !meta || meta.isLive) return;
        setActiveRoom((prev) => {
          if (!prev || prev.room.id !== roomId || !prev.room.isLive) return prev;
          return {
            ...prev,
            room: {
              ...prev.room,
              isLive: false,
              burned: meta.burned,
              endedAt: meta.endedAt > 0 ? meta.endedAt * 1000 : Date.now(),
            },
          };
        });
      } catch {
        // Keep the session if Sepolia read fails. Do not fake an end.
      }
    };

    void checkEnded();
    const id = window.setInterval(checkEnded, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeRoom?.room.id, activeRoom?.credential, activeRoom?.room.isLive]);

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
      void handleRoomSelect(selectedRoom);
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

  const enterRoom = (room: LiveRoom, credential: string) => {
    setActiveRoom({ room, credential });
    setPaymentModalOpen(false);
    setSelectedRoom(null);
    setInboxOpen(false);
  };

  const unlockHostIdentity = async (wallet: string) => {
    if (identityRef.current) return identityRef.current;
    try {
      const auth = await getAuthInfo();
      if (!auth || auth.walletAddress.toLowerCase() !== wallet.toLowerCase()) {
        return null;
      }
      const wrap =
        getSessionWrapKey() ??
        (await reauthenticateWithWallet(wallet, auth.authNonce, auth.authTimestamp));
      setSessionWrapKey(wrap);
      const loaded = await loadIdentity(wallet, wrap);
      if (loaded) {
        identityRef.current = loaded;
        setIdentity(loaded);
        setMetaAddress(encodeMetaAddress(identityToMetaAddress(loaded)));
      }
      return loaded;
    } catch (err) {
      console.warn('Could not unlock host payment keys:', err);
      return null;
    }
  };

  const sendStealthPayment = async (
    room: LiveRoom,
    fromAddress: string,
    amountEth: string,
    kind: StealthPaymentKind
  ): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    const { getProtocolAdapter } = await import('@/lib/protocol/adapters');
    const adapter = getProtocolAdapter();

    const hostEnsName = room.hostDisplayName?.endsWith('.eth')
      ? room.hostDisplayName
      : null;

    const hostMeta = await resolveHostStealthMetaAddress({
      ensName: hostEnsName,
      encodedMeta: room.stealthMetaAddress,
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
      entryPriceToWei(amountEth),
      kind,
      stealthPayment.sharedSecret
    );

    if (adapter.mode !== 'live') {
      throw new Error('Live Sepolia adapter is required to pay');
    }

    const { payStealthOnChain } = await import('@/lib/blockchain/rooms-contract');
    const txHash = await payStealthOnChain(
      fromAddress,
      stealthAddressHex,
      ephemeralPubKeyHex,
      metadata,
      entryPriceToWei(amountEth)
    );

    return {
      txHash,
      sharedSecret: stealthPayment.sharedSecret,
    };
  };

  const handleRoomSelect = async (room: LiveRoom) => {
    if (metamask.address && room.host.toLowerCase() === metamask.address.toLowerCase()) {
      enterRoom(room, 'host-stream');
      void unlockHostIdentity(metamask.address);
      return;
    }

    if (metamask.address) {
      const stored = await getAccessTicket(metamask.address, room.id);
      const memory = inboxMessages.find((message) => message.roomId === room.id);
      const credential = stored?.credential || memory?.encryptedPassword;
      if (credential) {
        enterRoom(room, credential);
        return;
      }
    }

    setSelectedRoom(room);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (): Promise<{ txHash: string; sharedSecret: Uint8Array }> => {
    if (!selectedRoom || !metamask.address) {
      throw new Error('Missing payment requirements');
    }

    return sendStealthPayment(selectedRoom, metamask.address, ENTRY_PRICE_ETH, 'access');
  };

  const handlePaymentSuccess = async (txHash: string, sharedSecret: Uint8Array) => {
    if (!selectedRoom || !metamask.address) return;

    const roomCredential = deriveAccessCredential(sharedSecret);
    const paidAt = new Date().toISOString();

    try {
      await saveAccessTicket({
        walletAddress: metamask.address,
        roomId: selectedRoom.id,
        roomTitle: selectedRoom.title,
        credential: roomCredential,
        paidAt,
        txHash,
        room: selectedRoom,
      });
    } catch (err) {
      console.warn('Could not persist access ticket:', err);
    }

    const message: InboxMessage = {
      id: `${metamask.address.toLowerCase()}:${selectedRoom.id}`,
      roomId: selectedRoom.id,
      roomTitle: selectedRoom.title,
      encryptedPassword: roomCredential,
      timestamp: paidAt,
      isRead: true,
    };

    setInboxMessages((prev) => [message, ...prev.filter((item) => item.roomId !== selectedRoom.id)]);
    enterRoom(selectedRoom, roomCredential);
  };

  const handleTip = async (amountEth: string) => {
    if (!activeRoom || !metamask.address || activeRoom.credential === 'host-stream') {
      throw new Error('Connect the wallet that paid, then tip from inside the room');
    }
    if (!activeRoom.room.isLive) {
      throw new Error('This livestream ended. Tips are closed');
    }
    await sendStealthPayment(activeRoom.room, metamask.address, amountEth, 'tip');
  };

  const handleUsePassword = async (message: InboxMessage) => {
    setInboxMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m)));

    const live = rooms.find((r) => r.id === message.roomId);
    if (live) {
      enterRoom(live, message.encryptedPassword);
      return;
    }

    if (metamask.address) {
      const stored = await getAccessTicket(metamask.address, message.roomId);
      if (stored?.room) {
        enterRoom(stored.room, message.encryptedPassword);
        return;
      }
    }

    setAppNotice({
      title: 'Room is offline',
      body: 'That room is no longer in Browse. The ticket is still saved if the host goes live again.',
    });
  };

  const handleLeaveRoom = async () => {
    const session = activeRoom;
    if (!session) return;

    if (session.credential === 'host-stream' && metamask.address && session.room.isLive) {
      const { endRoomOnChain } = await import('@/lib/blockchain/rooms-contract');
      const tokenId = parseRoomTokenId(session.room.id);
      if (tokenId === undefined) {
        setActiveRoom(null);
        void reloadRooms();
        return;
      }

      try {
        await endRoomOnChain(metamask.address, tokenId);
        const ended = {
          ...session.room,
          isLive: false,
          burned: true,
          endedAt: Date.now(),
          stealthMetaAddress: undefined,
        };
        upsertRoom(ended);
        setHostRooms((prev) => prev.filter((room) => room.id !== ended.id));
        setActiveRoom(null);
        void reloadRooms();
        setAppNotice({
          title: 'Stream ended',
          body: 'Viewers still in the room will be told it closed. Payments stay in one-time stealth addresses from your recipient.json — they are not in this wallet.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.toLowerCase().includes('reject') || message.toLowerCase().includes('denied')) {
          return;
        }
        throw new Error(message || 'Could not burn the room NFT. The listing may still be live.');
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
      viewers: 0,
      tags,
      isFeatured: false,
      thumbnail: '',
      isLive: true,
      burned: false,
      createdAt: Date.now(),
      createdBlock: blockNumber,
      stealthMetaAddress: encodedMeta,
    };

    setVerifiedEnsName(ensName);
    setGoLiveModalOpen(false);
    upsertRoom(hostRoom);
    setHostRooms((prev) => [hostRoom, ...prev.filter((room) => room.id !== hostRoom.id)]);
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

        {metamask.address && hostRooms.length > 0 && showFeatured && (
          <LiveGrid
            rooms={hostRooms}
            onSelectRoom={handleRoomSelect}
            title="Your streams"
            variant="manage"
            emptyTitle="No rooms yet"
            emptyDescription="Go Live to mint a room you can manage."
          />
        )}

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
          onClearFilters={searchQuery || categoryFilter ? clearFilters : undefined}
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
          hostIdentity={activeRoom.credential === 'host-stream' ? identity : null}
          onTip={activeRoom.credential === 'host-stream' ? undefined : handleTip}
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

      <ModalShell isOpen={!!appNotice} onClose={() => setAppNotice(null)} mobileBottomSheet>
        <div style={{ padding: '24px 24px 24px' }}>
          <h2
            style={{
              fontSize: 22,
              lineHeight: '28px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}
          >
            {appNotice?.title}
          </h2>
          <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
            {appNotice?.body}
          </p>
          <Button variant="primary" fullWidth onClick={() => setAppNotice(null)}>
            Got it
          </Button>
        </div>
      </ModalShell>

      {needsWalletConnect && (
        <WalletConnect
          onConnected={handleWalletConnected}
          onDismiss={() => setNeedsWalletConnect(false)}
        />
      )}
    </NetworkGuard>
  );
}
