/**
 * Session orchestration: ties crypto, protocol, and WebRTC together
 */

import { StealthIdentity, OfferPayload, AnswerPayload } from '../types/stealth';
import {
  identityToMetaAddress,
  generateStealthIdentity,
} from '../crypto/identity';
import { generateStealthAddress, checkStealthAddress } from '../crypto/stealth';
import {
  encryptSignalingPayload,
  decryptSignalingPayload,
} from '../crypto/encryption';
import { getProtocolAdapter } from '../protocol/adapters';
import { createCompleteOffer, createCompleteAnswer } from '../webrtc/signaling';

export type SessionStatus =
  | 'idle'
  | 'resolving-ens'
  | 'generating-stealth'
  | 'encrypting-offer'
  | 'publishing-offer'
  | 'scanning-offers'
  | 'decrypting-offer'
  | 'publishing-answer'
  | 'scanning-answers'
  | 'connecting-webrtc'
  | 'connected'
  | 'error';

export interface SessionState {
  status: SessionStatus;
  message: string;
  peerEnsName?: string;
  blockchainActivityComplete?: boolean;
  error?: string;
}

/**
 * Send offer flow (Alice initiates)
 */
export async function sendOfferFlow(
  identity: StealthIdentity,
  ensName: string,
  onStatusChange: (state: SessionState) => void
): Promise<{ offer: string; answer: string } | null> {
  const adapter = getProtocolAdapter();

  try {
    onStatusChange({ status: 'resolving-ens', message: `Resolving ${ensName}...` });
    const recipientAddress = await adapter.resolveENS(ensName);
    if (!recipientAddress) {
      throw new Error(`Could not resolve ${ensName}`);
    }

    const recipientMeta = await adapter.getMetaAddress(recipientAddress);
    if (!recipientMeta) {
      throw new Error(`No stealth meta-address found for ${ensName}`);
    }

    onStatusChange({
      status: 'generating-stealth',
      message: 'Generating stealth address for offer...',
    });
    const stealthForOffer = generateStealthAddress(recipientMeta);

    const replyIdentity = generateStealthIdentity();
    const replyMeta = identityToMetaAddress(replyIdentity);

    const rtcOffer = await createCompleteOffer();

    const offerPayload: OfferPayload = {
      sdp: rtcOffer.sdp,
      replyMetaAddress: replyMeta,
      timestamp: Date.now(),
    };

    onStatusChange({
      status: 'encrypting-offer',
      message: 'Encrypting WebRTC offer...',
    });
    const encryptedOffer = await encryptSignalingPayload(
      offerPayload,
      stealthForOffer.sharedSecret
    );

    const metadata = Buffer.concat([
      encryptedOffer.nonce,
      encryptedOffer.ciphertext,
    ]).toString('hex');

    onStatusChange({
      status: 'publishing-offer',
      message: 'Publishing encrypted offer on-chain...',
    });
    const txHash = await adapter.publishAnnouncement(
      BigInt(1),
      '0x' + Buffer.from(stealthForOffer.stealthAddress).toString('hex'),
      '0x' + Buffer.from(stealthForOffer.ephemeralPublicKey).toString('hex'),
      '0x' + metadata,
      stealthForOffer.viewTag
    );

    onStatusChange({
      status: 'scanning-answers',
      message: 'Blockchain signaling complete. Scanning for answer...',
      blockchainActivityComplete: true,
    });

    const pollStart = Date.now();
    const pollTimeout = 60_000;

    while (Date.now() - pollStart < pollTimeout) {
      const announcements = await adapter.scanAnnouncements();

      for (const announcement of announcements) {
        if (announcement.timestamp <= offerPayload.timestamp) continue;

        const ephemeralPubKey = Buffer.from(
          announcement.ephemeralPublicKey.slice(2),
          'hex'
        );
        const stealthAddr = Buffer.from(
          announcement.stealthAddress.slice(2),
          'hex'
        );

        const sharedSecret = checkStealthAddress(
          replyIdentity,
          ephemeralPubKey,
          stealthAddr,
          announcement.viewTag
        );

        if (sharedSecret) {
          const metadataBytes = Buffer.from(announcement.metadata.slice(2), 'hex');
          const nonce = metadataBytes.slice(0, 12);
          const ciphertext = metadataBytes.slice(12);

          const answerPayload = await decryptSignalingPayload<AnswerPayload>(
            { nonce, ciphertext },
            sharedSecret
          );

          if (answerPayload) {
            onStatusChange({
              status: 'connecting-webrtc',
              message: 'Answer received! Establishing P2P connection...',
            });
            return { offer: rtcOffer.sdp, answer: answerPayload.sdp };
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Answer timeout');
  } catch (error) {
    onStatusChange({
      status: 'error',
      message: 'Failed to send offer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Receive offer and send answer flow (Bob responds)
 */
export async function receiveOfferFlow(
  identity: StealthIdentity,
  onStatusChange: (state: SessionState) => void
): Promise<{ offer: string; answer: string } | null> {
  const adapter = getProtocolAdapter();

  try {
    onStatusChange({
      status: 'scanning-offers',
      message: 'Scanning for encrypted offers...',
    });

    const pollStart = Date.now();
    const pollTimeout = 120_000;

    while (Date.now() - pollStart < pollTimeout) {
      const announcements = await adapter.scanAnnouncements();

      for (const announcement of announcements) {
        const ephemeralPubKey = Buffer.from(
          announcement.ephemeralPublicKey.slice(2),
          'hex'
        );
        const stealthAddr = Buffer.from(
          announcement.stealthAddress.slice(2),
          'hex'
        );

        const sharedSecret = checkStealthAddress(
          identity,
          ephemeralPubKey,
          stealthAddr,
          announcement.viewTag
        );

        if (sharedSecret) {
          onStatusChange({
            status: 'decrypting-offer',
            message: 'Found matching offer! Decrypting...',
          });

          const metadataBytes = Buffer.from(announcement.metadata.slice(2), 'hex');
          const nonce = metadataBytes.slice(0, 12);
          const ciphertext = metadataBytes.slice(12);

          const offerPayload = await decryptSignalingPayload<OfferPayload>(
            { nonce, ciphertext },
            sharedSecret
          );

          if (offerPayload) {
            onStatusChange({
              status: 'generating-stealth',
              message: 'Generating stealth address for answer...',
            });

            const rtcAnswer = await createCompleteAnswer({
              sdp: offerPayload.sdp,
              type: 'offer',
            });

            const stealthForAnswer = generateStealthAddress(
              offerPayload.replyMetaAddress
            );

            const answerPayload: AnswerPayload = {
              sdp: rtcAnswer.sdp,
              timestamp: Date.now(),
            };

            onStatusChange({
              status: 'encrypting-offer',
              message: 'Encrypting WebRTC answer...',
            });
            const encryptedAnswer = await encryptSignalingPayload(
              answerPayload,
              stealthForAnswer.sharedSecret
            );

            const metadata = Buffer.concat([
              encryptedAnswer.nonce,
              encryptedAnswer.ciphertext,
            ]).toString('hex');

            onStatusChange({
              status: 'publishing-answer',
              message: 'Publishing encrypted answer on-chain...',
            });
            await adapter.publishAnnouncement(
              BigInt(1),
              '0x' + Buffer.from(stealthForAnswer.stealthAddress).toString('hex'),
              '0x' + Buffer.from(stealthForAnswer.ephemeralPublicKey).toString('hex'),
              '0x' + metadata,
              stealthForAnswer.viewTag
            );

            onStatusChange({
              status: 'connecting-webrtc',
              message: 'Blockchain signaling complete. Establishing P2P connection...',
              blockchainActivityComplete: true,
            });

            return { offer: offerPayload.sdp, answer: rtcAnswer.sdp };
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Offer timeout');
  } catch (error) {
    onStatusChange({
      status: 'error',
      message: 'Failed to receive offer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
