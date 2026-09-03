/**
 * WebRTC offer/answer helpers with ICE gathering
 * Non-trickle MVP: wait for complete ICE gathering before signaling
 */

export interface RTCSessionBundle {
  sdp: string;
  type: 'offer' | 'answer';
}

/**
 * Create WebRTC offer with complete ICE candidates (non-trickle)
 */
export async function createCompleteOffer(
  config?: RTCConfiguration
): Promise<RTCSessionBundle> {
  const pc = new RTCPeerConnection(config || { iceServers: [] });

  pc.createDataChannel('messenger', { ordered: true });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await waitForICEGathering(pc);

  const completeOffer = pc.localDescription;
  if (!completeOffer || !completeOffer.sdp) {
    throw new Error('Failed to create complete offer');
  }

  pc.close();

  return {
    sdp: completeOffer.sdp,
    type: 'offer',
  };
}

/**
 * Create WebRTC answer with complete ICE candidates (non-trickle)
 */
export async function createCompleteAnswer(
  offer: RTCSessionBundle,
  config?: RTCConfiguration
): Promise<RTCSessionBundle> {
  const pc = new RTCPeerConnection(config || { iceServers: [] });

  await pc.setRemoteDescription({
    type: 'offer',
    sdp: offer.sdp,
  });

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await waitForICEGathering(pc);

  const completeAnswer = pc.localDescription;
  if (!completeAnswer || !completeAnswer.sdp) {
    throw new Error('Failed to create complete answer');
  }

  pc.close();

  return {
    sdp: completeAnswer.sdp,
    type: 'answer',
  };
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
      reject(new Error('ICE gathering timeout'));
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
 * Establish RTCDataChannel connection from offer and answer
 */
export async function connectDataChannel(
  localBundle: RTCSessionBundle,
  remoteBundle: RTCSessionBundle,
  config?: RTCConfiguration
): Promise<{
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
}> {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection(config || { iceServers: [] });

    let dataChannel: RTCDataChannel;

    if (localBundle.type === 'offer') {
      dataChannel = pc.createDataChannel('messenger', { ordered: true });
      setupDataChannel(dataChannel);

      pc.setLocalDescription({ type: 'offer', sdp: localBundle.sdp })
        .then(() => pc.setRemoteDescription({ type: 'answer', sdp: remoteBundle.sdp }))
        .catch(reject);
    } else {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel(dataChannel);
      };

      pc.setRemoteDescription({ type: 'offer', sdp: remoteBundle.sdp })
        .then(() => pc.setLocalDescription({ type: 'answer', sdp: localBundle.sdp }))
        .catch(reject);
    }

    function setupDataChannel(channel: RTCDataChannel) {
      channel.onopen = () => {
        resolve({ connection: pc, dataChannel: channel });
      };

      channel.onerror = (error) => {
        reject(new Error(`DataChannel error: ${error}`));
      };
    }

    const timeout = setTimeout(() => {
      pc.close();
      reject(new Error('DataChannel connection timeout'));
    }, 15000);

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        clearTimeout(timeout);
      } else if (
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'disconnected'
      ) {
        clearTimeout(timeout);
        reject(new Error(`ICE connection ${pc.iceConnectionState}`));
      }
    };
  });
}
