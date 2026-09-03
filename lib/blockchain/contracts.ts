/**
 * ERC-6538 and ERC-5564 contract interactions
 * Minimal ABI encoding for meta-address registry and announcer
 */

import { callContract, sendContractTransaction, getLogs, verifyContractDeployed } from './transactions';
import { StealthMetaAddress } from '../types/stealth';

/**
 * Known contract addresses per chain (if deployed)
 * Most chains don't have these deployed yet
 */
export const KNOWN_CONTRACTS: Record<number, { registry?: string; announcer?: string }> = {
  // Mainnet
  1: {
    // No official deployment yet
  },
  // Sepolia
  11155111: {
    // No official deployment yet
  },
};

/**
 * ERC-6538: stealthMetaAddressOf(address,uint256) selector
 */
const STEALTH_META_ADDRESS_OF_SELECTOR = '0x' + 'a90261a0'.padEnd(8, '0'); // First 4 bytes of keccak256

/**
 * ERC-5564: announce(uint256,address,bytes,bytes) selector
 */
const ANNOUNCE_SELECTOR = '0x' + '4f0e0ef3'.padEnd(8, '0');

/**
 * Check if registry contract exists on current chain
 */
export async function checkRegistryDeployed(registryAddress: string): Promise<boolean> {
  try {
    return await verifyContractDeployed(registryAddress);
  } catch {
    return false;
  }
}

/**
 * Check if announcer contract exists on current chain
 */
export async function checkAnnouncerDeployed(announcerAddress: string): Promise<boolean> {
  try {
    return await verifyContractDeployed(announcerAddress);
  } catch {
    return false;
  }
}

/**
 * Read stealth meta-address from ERC-6538 registry
 * Returns null if not registered
 */
export async function readMetaAddress(
  registryAddress: string,
  userAddress: string,
  schemeId: bigint = BigInt(1)
): Promise<StealthMetaAddress | null> {
  try {
    // Encode call: stealthMetaAddressOf(address,uint256)
    const addressParam = userAddress.toLowerCase().slice(2).padStart(64, '0');
    const schemeParam = schemeId.toString(16).padStart(64, '0');
    const data = STEALTH_META_ADDRESS_OF_SELECTOR + addressParam + schemeParam;

    const result = await callContract(registryAddress, data);

    // Decode result: (bytes) containing spending and viewing public keys
    if (result === '0x' || result.length < 66) {
      return null;
    }

    // Parse returned bytes (simplified - assumes fixed 66-byte keys)
    // Real ABI decoding would parse dynamic bytes properly
    const hexData = result.slice(2);
    
    // Skip ABI offset/length headers, get to actual data
    // For now, return null if not a simple format
    if (hexData.length < 132) {
      return null;
    }

    const spendingPublicKey = Buffer.from(hexData.slice(0, 66), 'hex');
    const viewingPublicKey = Buffer.from(hexData.slice(66, 132), 'hex');

    return {
      spendingPublicKey,
      viewingPublicKey,
      scheme: 1,
    };
  } catch (error) {
    console.error('Failed to read meta-address:', error);
    return null;
  }
}

/**
 * Publish announcement to ERC-5564 announcer
 * Returns transaction hash
 */
export async function publishAnnouncement(
  announcerAddress: string,
  from: string,
  schemeId: bigint,
  stealthAddress: string,
  ephemeralPublicKey: string,
  metadata: string
): Promise<string> {
  try {
    // Encode call: announce(uint256 schemeId, address stealthAddress, bytes ephemeralPublicKey, bytes metadata)
    const schemeParam = schemeId.toString(16).padStart(64, '0');
    const addressParam = stealthAddress.toLowerCase().slice(2).padStart(64, '0');
    
    // For bytes parameters, need offset + length + data
    // This is simplified ABI encoding - production would use a proper library
    const ephemBytes = ephemeralPublicKey.slice(2);
    const metaBytes = metadata.slice(2);
    
    // Calculate offsets
    const offset1 = (4 * 32).toString(16).padStart(64, '0'); // offset to ephemeral
    const offset2 = ((4 + 1 + Math.ceil(ephemBytes.length / 2 / 32)) * 32).toString(16).padStart(64, '0'); // offset to metadata
    
    const ephemLength = (ephemBytes.length / 2).toString(16).padStart(64, '0');
    const ephemData = ephemBytes.padEnd(Math.ceil(ephemBytes.length / 64) * 64, '0');
    
    const metaLength = (metaBytes.length / 2).toString(16).padStart(64, '0');
    const metaData = metaBytes.padEnd(Math.ceil(metaBytes.length / 64) * 64, '0');
    
    const data = ANNOUNCE_SELECTOR + schemeParam + addressParam + offset1 + offset2 + 
                 ephemLength + ephemData + metaLength + metaData;

    return await sendContractTransaction(from, announcerAddress, data);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to publish announcement');
  }
}

/**
 * Scan for announcement events from ERC-5564 announcer
 */
export async function scanAnnouncements(
  announcerAddress: string,
  fromBlock: number = 0
): Promise<Array<{
  schemeId: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  metadata: string;
  txHash: string;
  blockNumber: string;
}>> {
  try {
    // Event signature: Announcement(uint256,address,bytes,bytes)
    // keccak256 of signature as topic[0]
    const eventTopic = '0x' + 'ec3c2d6c9e1c7e4e1efbeaef5ef15e5f3c5f1a1e9f0f8c4f0a0c1b2d3e4f5a6b'; // placeholder
    
    const fromBlockHex = '0x' + fromBlock.toString(16);
    const logs = await getLogs(announcerAddress, fromBlockHex, 'latest');

    return logs.map((log: any) => ({
      schemeId: log.topics[1],
      stealthAddress: '0x' + log.topics[2].slice(-40),
      ephemeralPublicKey: log.data.slice(0, 68),
      metadata: log.data.slice(68),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  } catch (error) {
    console.error('Failed to scan announcements:', error);
    return [];
  }
}

/**
 * Get recommended contracts for current chain
 */
export function getContractAddresses(chainId: number): {
  registry: string | null;
  announcer: string | null;
} {
  const contracts = KNOWN_CONTRACTS[chainId];
  return {
    registry: contracts?.registry || null,
    announcer: contracts?.announcer || null,
  };
}
