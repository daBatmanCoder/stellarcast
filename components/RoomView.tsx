'use client';

import { useState } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { formatViewerCount, hostInitials, truncateAddress } from '@/lib/utils/asset';
import { Avatar } from './ui/Avatar';
import { LiveBadge, Tag } from './ui/Badges';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconChevronLeft, IconClose, IconPanel } from './ui/Icons';
import { useAnnouncementScanner } from '@/hooks/useAnnouncementScanner';
import type { MatchedPayment } from '@/lib/stealth/announcement-watcher';
import { parseNativeEthAmount, parseStealthPaymentKind } from '@/lib/crypto/stealth';
import { formatEther } from 'viem';

const TIP_AMOUNTS = ['0.001', '0.005', '0.01'] as const;

interface RoomViewProps {
  room: LiveRoom;
  roomCredential: string;
  onLeave: () => void;
  isHost?: boolean;
  hostIdentity?: StealthIdentity | null;
  onPaymentDetected?: (payment: MatchedPayment) => void;
  onTip?: (amountEth: string) => Promise<void>;
}

export function RoomView({ 
  room, 
  roomCredential, 
  onLeave, 
  isHost = false,
  hostIdentity = null,
  onPaymentDetected,
  onTip,
}: RoomViewProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [detectedPayments, setDetectedPayments] = useState<MatchedPayment[]>([]);
  const [tipAmount, setTipAmount] = useState<(typeof TIP_AMOUNTS)[number]>('0.001');
  const [tipping, setTipping] = useState(false);
  const [tipError, setTipError] = useState('');
  const [tipDone, setTipDone] = useState('');

  const scanner = useAnnouncementScanner({
    identity: isHost ? hostIdentity : null,
    enabled: isHost && hostIdentity !== null,
    intervalMs: 30000,
    fromBlock: room.createdBlock,
    excludeCaller: room.host,
    onPaymentDetected: (payment) => {
      setDetectedPayments((prev) => {
        if (prev.some((p) => p.announcement.txHash === payment.announcement.txHash)) {
          return prev;
        }
        return [payment, ...prev];
      });
      onPaymentDetected?.(payment);
    },
  });

  const handleLeave = () => {
    onLeave();
  };

  const hostLabel = room.hostDisplayName || truncateAddress(room.host);
  const paymentKind = (payment: MatchedPayment) =>
    parseStealthPaymentKind(payment.announcement.metadata, payment.sharedSecret);
  const accessPayments = isHost
    ? detectedPayments.filter((payment) => paymentKind(payment) === 'access')
    : [];
  const tipPayments = isHost
    ? detectedPayments.filter((payment) => paymentKind(payment) === 'tip')
    : [];
  const tipTotalWei = tipPayments.reduce((sum, payment) => {
    return sum + (parseNativeEthAmount(payment.announcement.metadata) ?? BigInt(0));
  }, BigInt(0));
  const paidJoins = accessPayments.length;

  const handleTip = async () => {
    if (!onTip || tipping) return;
    setTipping(true);
    setTipError('');
    setTipDone('');
    try {
      await onTip(tipAmount);
      setTipDone(`Sent ${tipAmount} ETH to the creator`);
    } catch (err) {
      setTipError(err instanceof Error ? err.message : 'Tip failed');
    } finally {
      setTipping(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'var(--bg-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          height: 'var(--nav-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 12px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Button variant="ghost" size="sm" onClick={handleLeave}>
            <IconChevronLeft size={16} />
            {isHost && room.isLive ? 'End stream' : 'Leave'}
          </Button>
          {room.isLive ? <LiveBadge /> : (
            <span className="tag-pill" style={{ textTransform: 'uppercase' }}>ended</span>
          )}
          <span className="truncate-1" style={{ fontSize: 14, fontWeight: 600 }}>
            {room.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {formatViewerCount(isHost ? paidJoins : room.viewers)} {isHost ? 'paid joins' : 'viewers'}
          </span>
          <IconButton
            label={panelOpen ? 'Hide session panel' : 'Show session panel'}
            onClick={() => setPanelOpen((v) => !v)}
            active={panelOpen}
          >
            <IconPanel size={18} />
          </IconButton>
        </div>
      </header>

      <div className="watch-layout" style={{ flex: 1, minHeight: 0 }}>
        <div className="watch-player-column">
          <div style={{ position: 'relative', background: '#000', aspectRatio: '16 / 9', width: '100%' }}>
            {/* Host: Payment detection notifications */}
            {isHost && detectedPayments.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  maxWidth: 320,
                  backgroundColor: 'rgba(0, 245, 147, 0.95)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  zIndex: 15,
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 700,
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 18 }}>💰</span>
                    {accessPayments.length > 0 && tipPayments.length > 0
                      ? `${paidJoins} joined · ${tipPayments.length} tip${tipPayments.length === 1 ? '' : 's'}`
                      : tipPayments.length > 0
                        ? `${tipPayments.length} Tip${tipPayments.length !== 1 ? 's' : ''} received`
                        : `${paidJoins} Paid join${paidJoins !== 1 ? 's' : ''}`}
                  </div>
                  <button
                    onClick={() => setDetectedPayments([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.5)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <IconClose size={16} />
                  </button>
                </div>
                <div style={{ 
                  fontSize: 12, 
                  color: 'rgba(0, 0, 0, 0.7)',
                  lineHeight: 1.5,
                }}>
                  {tipPayments.length > 0 && accessPayments.length === 0
                    ? `Tips total ${formatEther(tipTotalWei)} ETH to your stealth addresses.`
                    : tipPayments.length > 0
                      ? `${paidJoins} access payment${paidJoins === 1 ? '' : 's'} and ${formatEther(tipTotalWei)} ETH in tips.`
                      : 'Viewers paid the entry price. Access keys are in their inbox.'}
                </div>
                {scanner.isScanning && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      backgroundColor: '#00f593',
                    }} />
                    Scanner active
                  </div>
                )}
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 24, maxWidth: 400 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, margin: 0 }}>
                  {room.isLive ? 'Video comes later' : 'Stream ended'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '8px 0 0', lineHeight: 1.4 }}>
                  {isHost
                    ? 'Use the host dashboard for paid joins and tips. Camera and WebRTC stay off until payments are solid.'
                    : 'You are in the paid room. Tip the creator from the session panel. Livestream video is not on yet.'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <Avatar initials={hostInitials(room.host, room.hostDisplayName)} size={40} live={room.isLive} />
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{room.title}</h1>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    {hostLabel} · {room.category}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!isHost && onTip && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setPanelOpen(true);
                    }}
                  >
                    Tip creator
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={handleLeave}>
                  {isHost && room.isLive ? 'End stream' : 'Leave'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
              {room.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.45 }}>
              {isHost
                ? paidJoins > 0 || tipPayments.length > 0
                  ? `${paidJoins} paid join${paidJoins === 1 ? '' : 's'}. ${tipPayments.length} tip${tipPayments.length === 1 ? '' : 's'} (${formatEther(tipTotalWei)} ETH).`
                  : 'Admin view. Paid joins and tips land here as stealth payments arrive.'
                : 'You already paid. Leave and rejoin without paying again. Tips are a private stealth payment — only the creator can see them.'}
            </p>
          </div>
        </div>

        <aside className={`watch-side-panel ${panelOpen ? '' : 'collapsed'}`} aria-hidden={!panelOpen}>
          {panelOpen && (
            <>
              <header
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  flexShrink: 0,
                }}
              >
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                  {isHost ? 'Host dashboard' : 'Session'}
                </h2>
                <IconButton label="Close panel" onClick={() => setPanelOpen(false)}>
                  <IconClose size={16} />
                </IconButton>
              </header>

              <div className="scroll-y" style={{ flex: 1, padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <Row label="Status" value={room.burned ? 'burned' : room.isLive ? 'live' : 'ended'} />
                  <Row label="Category" value={room.category} />
                  <Row label="Host" value={hostLabel} />
                  {isHost ? (
                    <>
                      <Row label="Paid joins" value={String(paidJoins)} />
                      <Row label="Tips" value={`${tipPayments.length}`} />
                      <Row label="Tip total" value={`${formatEther(tipTotalWei)} ETH`} />
                      <Row label="Room id" value={room.id} />
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        {hostIdentity
                          ? 'Joins are unique stealth access payments after this room was minted. Tips are separate stealth sends and do not create new tickets.'
                          : 'Unlock payment keys to count joins. Reopen this stream and approve the wallet signature, or finish Go Live first.'}
                      </p>
                      {detectedPayments.length > 0 && (
                        <div>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 6px' }}>Recent</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {detectedPayments.slice(0, 6).map((payment) => {
                              const kind = paymentKind(payment);
                              const amount = parseNativeEthAmount(payment.announcement.metadata);
                              return (
                                <p
                                  key={payment.announcement.txHash}
                                  className="mono"
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-secondary)',
                                    background: 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: 8,
                                    margin: 0,
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {kind === 'tip' ? 'Tip' : 'Join'} · {amount ? `${formatEther(amount)} ETH` : '—'}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>Access ticket</p>
                        <p
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 8,
                            wordBreak: 'break-all',
                            margin: 0,
                          }}
                        >
                          {roomCredential}
                        </p>
                      </div>
                      {onTip && (
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 8px' }}>Tip the creator</p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                            Private stealth payment. Only the creator sees it. Does not unlock a second ticket.
                          </p>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {TIP_AMOUNTS.map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => setTipAmount(amount)}
                                style={{
                                  flex: 1,
                                  height: 36,
                                  borderRadius: 10,
                                  border: tipAmount === amount ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                  background: tipAmount === amount ? 'rgba(124, 92, 255, 0.16)' : 'var(--bg-elevated)',
                                  color: 'var(--text-primary)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {amount}
                              </button>
                            ))}
                          </div>
                          <Button variant="primary" size="sm" fullWidth onClick={() => void handleTip()} disabled={tipping}>
                            {tipping ? 'Sending tip…' : `Send ${tipAmount} ETH`}
                          </Button>
                          {tipDone && (
                            <p style={{ fontSize: 12, color: 'var(--success)', margin: '8px 0 0' }}>{tipDone}</p>
                          )}
                          {tipError && (
                            <p style={{ fontSize: 12, color: 'var(--live)', margin: '8px 0 0' }}>{tipError}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
