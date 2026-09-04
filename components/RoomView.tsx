'use client';

import { useState, useEffect, useRef } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import type { StealthIdentity } from '@/lib/types/stealth';
import { formatViewerCount, hostInitials, truncateAddress } from '@/lib/utils/asset';
import { Avatar } from './ui/Avatar';
import { LiveBadge, Tag } from './ui/Badges';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconChevronLeft, IconClose, IconPanel, IconWarning } from './ui/Icons';
import { useAnnouncementScanner } from '@/hooks/useAnnouncementScanner';
import type { MatchedPayment } from '@/lib/stealth/announcement-watcher';

interface RoomViewProps {
  room: LiveRoom;
  roomCredential: string;
  onLeave: () => void;
  isHost?: boolean;
  hostIdentity?: StealthIdentity | null;
  onPaymentDetected?: (payment: MatchedPayment) => void;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';

export function RoomView({ 
  room, 
  roomCredential, 
  onLeave, 
  isHost = false,
  hostIdentity = null,
  onPaymentDetected,
}: RoomViewProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [detectedPayments, setDetectedPayments] = useState<MatchedPayment[]>([]);

  const scanner = useAnnouncementScanner({
    identity: isHost ? hostIdentity : null,
    enabled: isHost && hostIdentity !== null,
    intervalMs: 30000,
    fromBlock: room.createdBlock,
    excludeCaller: room.host,
    onPaymentDetected: (payment) => {
      console.log('Payment detected!', payment);
      setDetectedPayments((prev) => {
        if (prev.some((p) => p.announcement.txHash === payment.announcement.txHash)) {
          return prev;
        }
        return [payment, ...prev];
      });
      onPaymentDetected?.(payment);
    },
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initializeConnection();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        } else if (state === 'failed') {
          setConnectionState('failed');
          setError('Connection failed');
        } else if (state === 'connecting' || state === 'new') {
          setConnectionState('connecting');
        }
      };

      // Demo: local preview ready without signaling server
      setConnectionState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize stream');
      setConnectionState('failed');
    }
  };

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
  };

  const handleLeave = () => {
    cleanup();
    onLeave();
  };

  const hostLabel = room.hostDisplayName || truncateAddress(room.host);

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
            Leave
          </Button>
          {connectionState === 'connected' ? <LiveBadge /> : (
            <span className="tag-pill" style={{ textTransform: 'uppercase' }}>{connectionState}</span>
          )}
          <span className="truncate-1" style={{ fontSize: 14, fontWeight: 600 }}>
            {room.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {formatViewerCount(room.viewers)} viewers
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
                    {detectedPayments.length} Payment{detectedPayments.length !== 1 ? 's' : ''} Received
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
                  Viewers have paid to your stealth address. Room access credentials delivered to their inbox.
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
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : localStream ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    className="spin"
                    style={{
                      width: 40,
                      height: 40,
                      margin: '0 auto 12px',
                      borderRadius: '50%',
                      border: '2px solid var(--bg-elevated)',
                      borderTopColor: 'var(--accent-primary)',
                    }}
                  />
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Initializing stream…</p>
                </div>
              </div>
            )}

            {localStream && remoteStream && (
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  width: 160,
                  aspectRatio: '16 / 9',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                  background: '#000',
                }}
              >
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {error && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.82)',
                  padding: 16,
                }}
              >
                <div className="surface" style={{ maxWidth: 360, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--live)' }}>
                    <IconWarning size={18} />
                    <strong style={{ fontSize: 14 }}>Stream error</strong>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{error}</p>
                  <Button variant="secondary" size="sm" onClick={handleLeave}>
                    Leave room
                  </Button>
                </div>
              </div>
            )}
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
                <Button variant="secondary" size="sm" onClick={handleLeave}>Leave</Button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
              {room.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.45 }}>
              {isHost
                ? detectedPayments.length > 0
                  ? `${detectedPayments.length} viewer payment${detectedPayments.length === 1 ? '' : 's'} matched this room.`
                  : 'Waiting for viewer stealth payments. Room status is in the side panel.'
                : 'Private livestream access unlocked via stealth payment. Session status and access metadata are available in the side panel.'}
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
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Session</h2>
                <IconButton label="Close panel" onClick={() => setPanelOpen(false)}>
                  <IconClose size={16} />
                </IconButton>
              </header>

              <div className="scroll-y" style={{ flex: 1, padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <Row label="Status" value={connectionState} />
                  <Row label="Viewers" value={formatViewerCount(room.viewers)} />
                  <Row label="Category" value={room.category} />
                  <Row label="Host" value={hostLabel} />
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>Access key</p>
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
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Full peer signaling requires a deployed signaling server. This demo shows local capture and peer connection setup.
                  </p>
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
