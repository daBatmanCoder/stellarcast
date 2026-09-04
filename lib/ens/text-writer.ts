/**
 * ENS text record writing on Sepolia
 * Requires wallet signature to set text records on owned ENS names
 */

import { createWalletClient, custom, namehash, encodeFunctionData, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

// Sepolia ENS PublicResolver address
const SEPOLIA_PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';

const RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string key, string value)',
]);

/**
 * Set ENS text record on Sepolia
 * Requires connected MetaMask wallet that owns the ENS name
 */
export async function setSepoliaTextRecord(
  ensName: string,
  key: string,
  value: string,
  fromAddress: string
): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  try {
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum),
    });

    // Calculate ENS node
    const node = namehash(ensName);

    // Encode setText call
    const data = encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setText',
      args: [node, key, value],
    });

    // Send transaction via MetaMask
    const hash = await walletClient.sendTransaction({
      account: fromAddress as `0x${string}`,
      to: SEPOLIA_PUBLIC_RESOLVER as `0x${string}`,
      data,
    } as any); // Type workaround for viem wallet client

    return hash;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rejected') || error.message.includes('denied')) {
        throw new Error('Transaction cancelled by user');
      }
      throw error;
    }
    throw new Error('Failed to set ENS text record');
  }
}
