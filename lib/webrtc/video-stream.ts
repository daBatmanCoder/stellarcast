/**
 * Real WebRTC video streaming
 * Establishes peer connections with video/audio tracks
 */

export interface StreamConfig {
  stunServers?: string[];
  turnServers?: RTCIceServer[];
}

export interface PeerConnection {
  connection: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  dataChannel?: RTCDataChannel;
  state: RTCPeerConnectionState;
}

/**
 * Default ICE server configuration (public STUN servers)
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Create RTCPeerConnection with ICE servers
 */
export function createPeerConnection(config?: StreamConfig): RTCPeerConnection {
  const iceServers: RTCIceServer[] = config?.stunServers 
    ? config.stunServers.map(url => ({ urls: url } as RTCIceServer))
    : DEFAULT_ICE_SERVERS;

  if (config?.turnServers) {
    iceServers.push(...config.turnServers);
  }

  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 10,
  });
}

/**
 * Get user media (camera + microphone)
 * For broadcaster/creator side
 */
export async function getUserMedia(
  constraints: MediaStreamConstraints = { video: true, audio: true }
): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera/microphone permission denied. Please allow access in browser settings.');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('No camera or microphone found. Please connect media devices.');
      }
      throw new Error(`Media access failed: ${error.message}`);
    }
    throw new Error('Failed to access camera/microphone');
  }
}

/**
 * Create offer with video/audio tracks
 * Returns SDP offer string for signaling
 */
export async function createVideoOffer(
  pc: RTCPeerConnection,
  localStream: MediaStream
): Promise<string> {
  // Add local tracks to peer connection
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  const offer = await pc.createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: true,
  });

  await pc.setLocalDescription(offer);

  // Wait for ICE gathering to complete
  await waitForICEGathering(pc);

  return pc.localDescription!.sdp;
}

/**
 * Create answer with video/audio tracks
 * Returns SDP answer string for signaling
 */
export async function createVideoAnswer(
  pc: RTCPeerConnection,
  offerSdp: string,
  localStream?: MediaStream
): Promise<string> {
  await pc.setRemoteDescription({
    type: 'offer',
    sdp: offerSdp,
  });

  // Add local tracks if streaming back (two-way video)
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // Wait for ICE gathering
  await waitForICEGathering(pc);

  return pc.localDescription!.sdp;
}

/**
 * Apply remote answer SDP
 */
export async function applyAnswer(
  pc: RTCPeerConnection,
  answerSdp: string
): Promise<void> {
  await pc.setRemoteDescription({
    type: 'answer',
    sdp: answerSdp,
  });
}

/**
 * Wait for ICE gathering to complete
 */
function waitForICEGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', checkState);
      reject(new Error('ICE gathering timeout (10s)'));
    }, 10000);

    function checkState() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    }

    pc.addEventListener('icegatheringstatechange', checkState);
  });
}

/**
 * Setup remote stream listener
 * Fires callback when remote tracks arrive
 */
export function onRemoteStream(
  pc: RTCPeerConnection,
  callback: (stream: MediaStream) => void
): () => void {
  const remoteStream = new MediaStream();

  const trackHandler = (event: RTCTrackEvent) => {
    event.streams[0]?.getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    callback(remoteStream);
  };

  pc.addEventListener('track', trackHandler);

  return () => {
    pc.removeEventListener('track', trackHandler);
  };
}

/**
 * Monitor connection state changes
 */
export function onConnectionStateChange(
  pc: RTCPeerConnection,
  callback: (state: RTCPeerConnectionState) => void
): () => void {
  const handler = () => {
    callback(pc.connectionState);
  };

  pc.addEventListener('connectionstatechange', handler);

  return () => {
    pc.removeEventListener('connectionstatechange', handler);
  };
}

/**
 * Cleanup peer connection and streams
 */
export function cleanup(pc: RTCPeerConnection, localStream?: MediaStream): void {
  // Stop all local tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Close peer connection
  pc.close();
}

/**
 * Get connection statistics
 */
export async function getConnectionStats(pc: RTCPeerConnection): Promise<{
  videoCodec?: string;
  audioCodec?: string;
  bytesReceived: number;
  bytesSent: number;
  packetLoss?: number;
}> {
  const stats = await pc.getStats();
  
  let bytesReceived = 0;
  let bytesSent = 0;
  let videoCodec: string | undefined;
  let audioCodec: string | undefined;

  stats.forEach(report => {
    if (report.type === 'inbound-rtp') {
      bytesReceived += (report as any).bytesReceived || 0;
      if (report.kind === 'video') {
        videoCodec = (report as any).codecId;
      }
      if (report.kind === 'audio') {
        audioCodec = (report as any).codecId;
      }
    }
    if (report.type === 'outbound-rtp') {
      bytesSent += (report as any).bytesSent || 0;
    }
  });

  return {
    videoCodec,
    audioCodec,
    bytesReceived,
    bytesSent,
  };
}

export function streamPeerId(roomId: string): string {
  return `sc${roomId.replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 60);
}

type BroadcastHandle = {
  stream: MediaStream;
  destroy: () => void;
};

const TURN_USER = process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject';
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject';

function iceServers(): RTCIceServer[] {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: TURN_USER, credential: TURN_CREDENTIAL },
    { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: TURN_USER, credential: TURN_CREDENTIAL },
    { urls: 'turn:openrelay.metered.ca:443', username: TURN_USER, credential: TURN_CREDENTIAL },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: TURN_USER, credential: TURN_CREDENTIAL },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: TURN_USER, credential: TURN_CREDENTIAL },
  ];
}

const PEER_OPTIONS = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  debug: 0,
  config: {
    iceServers: iceServers(),
  },
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function openPeer(id?: string): Promise<{ peer: import('peerjs').default; destroy: () => void }> {
  const { default: Peer } = await import('peerjs');
  const peer = id ? new Peer(id, PEER_OPTIONS) : new Peer(PEER_OPTIONS);
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => resolve();
    const onError = (error: Error) => reject(error);
    peer.once('open', onOpen);
    peer.once('error', onError);
  });
  return {
    peer,
    destroy: () => {
      peer.destroy();
    },
  };
}

async function openPeerWithRetry(id: string) {
  try {
    return await openPeer(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.toLowerCase().includes('unavailable') && !message.toLowerCase().includes('taken')) {
      throw error;
    }
    await wait(1500);
    return openPeer(id);
  }
}

export async function startHostBroadcast(roomId: string): Promise<BroadcastHandle> {
  const stream = await getUserMedia({ video: true, audio: true });
  let opened: Awaited<ReturnType<typeof openPeer>>;
  try {
    opened = await openPeerWithRetry(streamPeerId(roomId));
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  const closers: Array<() => void> = [];
  const called = new Set<string>();

  const callViewer = (viewerId: string) => {
    if (!viewerId || called.has(viewerId)) return;
    called.add(viewerId);
    const call = opened.peer.call(viewerId, stream);
    if (call) {
      closers.push(() => call.close());
    }
  };

  opened.peer.on('connection', (conn) => {
    closers.push(() => conn.close());
    const startCall = () => callViewer(conn.peer);
    if (conn.open) startCall();
    else conn.on('open', startCall);
  });

  opened.peer.on('call', (call) => {
    call.answer(stream);
    closers.push(() => call.close());
  });

  return {
    stream,
    destroy: () => {
      closers.forEach((close) => close());
      stream.getTracks().forEach((track) => track.stop());
      opened.destroy();
    },
  };
}

export async function joinHostBroadcast(roomId: string): Promise<BroadcastHandle> {
  const opened = await openPeer();
  const hostId = streamPeerId(roomId);
  const closers: Array<() => void> = [];

  const stream = await new Promise<MediaStream>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, remote?: MediaStream) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (remote) resolve(remote);
      else reject(error || new Error('Could not get the host camera'));
    };

    const timer = window.setTimeout(() => {
      finish(new Error('Could not get the host camera. Keep the host tab open, then refresh this page.'));
    }, 25000);

    opened.peer.on('call', (call) => {
      closers.push(() => call.close());
      call.answer();
      call.on('stream', (remote) => finish(undefined, remote));
      call.on('error', (error) => finish(error));
    });

    const knock = () => {
      const conn = opened.peer.connect(hostId, { reliable: true });
      closers.push(() => conn.close());
      conn.on('error', () => undefined);
    };

    knock();
    window.setTimeout(knock, 2500);
    window.setTimeout(knock, 6000);
  }).catch((error) => {
    closers.forEach((close) => close());
    opened.destroy();
    throw error;
  });

  return {
    stream,
    destroy: () => {
      closers.forEach((close) => close());
      opened.destroy();
    },
  };
}
