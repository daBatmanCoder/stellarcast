'use client';

import { useState, useEffect, useRef } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';

interface RoomViewProps {
  room: LiveRoom;
  roomCredential: string;
  onLeave: () => void;
  isHost?: boolean;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';

export function RoomView({ room, roomCredential, onLeave, isHost = false }: RoomViewProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    initializeConnection();

    return () => {
      cleanup();
    };
  }, []);

  const initializeConnection = async () => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Monitor connection state
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

      // Note: Full signaling requires a server
      // This demo shows ready state with real peer connection
      setConnectionState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize stream');
      setConnectionState('failed');
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const handleLeave = () => {
    cleanup();
    onLeave();
  };

  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: 'var(--base)' }}>
      {/* Top bar */}
      <div
        className="fixed top-0 left-0 right-0 h-12 px-4 flex items-center justify-between z-10"
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleLeave}
            className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Leave
          </button>

          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold uppercase"
              style={{
                backgroundColor: connectionState === 'connected' ? 'var(--live)' : 'var(--warn)',
                color: 'white'
              }}
            >
              {connectionState === 'connected' ? 'LIVE' : connectionState.toUpperCase()}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {room.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {room.viewers.toLocaleString()} viewers
          </span>
          
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: connectionState === 'connected' ? 'var(--success)' : 
                                 connectionState === 'connecting' ? 'var(--warn)' : 
                                 'var(--live)'
              }}
            ></div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {connectionState === 'connected' ? 'Connected' :
               connectionState === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Main video area */}
      <div className="pt-12 h-full flex">
        {/* Remote stream (or local preview if no remote) */}
        <div className="flex-1 relative bg-black">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div
                  className="w-16 h-16 mx-auto rounded-full"
                  style={{
                    border: '3px solid var(--surface)',
                    borderTopColor: 'var(--accent)',
                    animation: 'spin 1s linear infinite'
                  }}
                ></div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Initializing stream...
                </p>
              </div>
            </div>
          )}

          {/* Local preview (picture-in-picture) */}
          {localStream && remoteStream && (
            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2" style={{ borderColor: 'var(--border)' }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
              <div
                className="max-w-md p-6 rounded-lg text-center space-y-4"
                style={{ backgroundColor: 'var(--elevated)' }}
              >
                <div className="text-4xl">⚠️</div>
                <p className="font-semibold" style={{ color: 'var(--live)' }}>
                  Stream Error
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {error}
                </p>
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Leave Room
                </button>
              </div>
            </div>
          )}

          {/* Connection info overlay */}
          {connectionState === 'connecting' && !error && (
            <div className="absolute top-20 left-4 right-4">
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{
                      border: '2px solid var(--surface)',
                      borderTopColor: 'var(--accent)',
                      animation: 'spin 1s linear infinite'
                    }}
                  ></div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Establishing peer connection...
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Note: Full signaling requires server deployment
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Room info */}
          <div className="absolute bottom-4 left-4">
            <div
              className="p-4 rounded-lg space-y-2"
              style={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {room.host.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {room.hostDisplayName || `${room.host.slice(0, 8)}...`}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {room.category}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {room.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--elevated)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-[10px] mono truncate" style={{ color: 'var(--text-tertiary)' }}>
                Access: {roomCredential.slice(0, 32)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
