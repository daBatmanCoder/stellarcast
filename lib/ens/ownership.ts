/**
 * ENS Ownership Verification via Signature
 */

import { verifyMessage } from 'viem';

const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Create ENS ownership proof message
 */
export function createENSOwnershipMessage(
  ensName: string,
  address: string,
  nonce: string
): string {
  return `STELLARCAST ENS ownership
ENS: ${ensName}
Address: ${address}
ChainId: ${SEPOLIA_CHAIN_ID}
Nonce: ${nonce}`;
}

/**
 * Generate a random nonce for the ownership message
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify ENS ownership signature
 */
export async function verifyENSOwnership(
  ensName: string,
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`
    });

    return valid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Request signature from MetaMask for ENS ownership
 */
export async function requestENSOwnershipSignature(
  ensName: string,
  address: string
): Promise<{ message: string; signature: string; nonce: string }> {
  if (!window.ethereum) {
    throw new Error('MetaMask not available');
  }

  const nonce = generateNonce();
  const message = createENSOwnershipMessage(ensName, address, nonce);

  try {
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    }) as string;

    return { message, signature, nonce };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Signature request failed');
  }
}
