/**
 * ERC-6538 and ERC-5564 contract interactions
 */

import {
  encodeFunctionData,
  decodeFunctionResult,
  decodeEventLog,
  parseAbi,
  parseAbiItem,
  type Hex,
} from 'viem';
import { callContract, sendContractTransaction, getLogs, verifyContractDeployed } from './transactions';
import { StealthMetaAddress } from '../types/stealth';
import { encodeMetaAddress, tryDecodeMetaAddress } from '../crypto/identity';
import { parseViewTagFromMetadata } from '../crypto/stealth';

/**
 * Known ERC-6538 registry and ERC-5564 announcer contract addresses per chain
 * PRODUCTION: Sepolia only (chain ID 11155111)
 */
export const KNOWN_CONTRACTS: Record<number, { registry?: string; announcer?: string }> = {
  11155111: {
    registry: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538',
    announcer: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  },
  1: {
    registry: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538',
    announcer: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  },
  17000: {
    registry: '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538',
    announcer: '0x55649E01B5Df198D18D95b5cc5051630cfD45564',
  },
};

export const SEPOLIA_CHAIN_ID = 11155111;

export function isSupportedChain(chainId: number): boolean {
  return chainId === SEPOLIA_CHAIN_ID;
}

const REGISTRY_ABI = parseAbi([
  'function registerKeys(uint256 schemeId, bytes stealthMetaAddress)',
  'function stealthMetaAddressOf(address registrant, uint256 schemeId) view returns (bytes)',
]);

const ANNOUNCER_ABI = parseAbi([
  'function announce(uint256 schemeId, address stealthAddress, bytes ephemeralPubKey, bytes metadata)',
]);

const ANNOUNCEMENT_EVENT = parseAbiItem(
  'event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)'
);

/** Scheme 1 meta-address bytes = compressed spend pubkey (33) || compressed view pubkey (33) */
export function metaAddressToBytes(meta: StealthMetaAddress): Hex {
  const spend = Buffer.from(meta.spendingPublicKey).toString('hex');
  const view = Buffer.from(meta.viewingPublicKey).toString('hex');
  return `0x${spend}${view}` as Hex;
}

export function bytesToMetaAddress(hex: string): StealthMetaAddress | null {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  // 33+33 bytes = 132 hex chars; some registries may include scheme prefix byte
  if (clean.length === 132) {
    return {
      spendingPublicKey: Buffer.from(clean.slice(0, 66), 'hex'),
      viewingPublicKey: Buffer.from(clean.slice(66), 'hex'),
      scheme: 1,
    };
  }
  if (clean.length === 134 && clean.startsWith('01')) {
    return {
      spendingPublicKey: Buffer.from(clean.slice(2, 68), 'hex'),
      viewingPublicKey: Buffer.from(clean.slice(68), 'hex'),
      scheme: 1,
    };
  }
  return null;
}

/**
 * Parse ERC-5564 stealth meta-address from ENS text record format
 * Format: st:eth:0x<66 hex chars spending pubkey><66 hex chars viewing pubkey>
 * Example: st:eth:0x0341ce6167...633
 */
export function parseStealthMetaAddressFromENS(textRecord: string): StealthMetaAddress | null {
  return tryDecodeMetaAddress(textRecord);
}

export function encodeStealthMetaAddressForENS(meta: StealthMetaAddress): string {
  return encodeMetaAddress(meta);
}

export function publicKeysMatch(a: StealthMetaAddress, b: StealthMetaAddress): boolean {
  const spendA = Buffer.from(a.spendingPublicKey).toString('hex');
  const spendB = Buffer.from(b.spendingPublicKey).toString('hex');
  const viewA = Buffer.from(a.viewingPublicKey).toString('hex');
  const viewB = Buffer.from(b.viewingPublicKey).toString('hex');
  return spendA === spendB && viewA === viewB;
}

export async function checkRegistryDeployed(registryAddress: string): Promise<boolean> {
  try {
    return await verifyContractDeployed(registryAddress);
  } catch {
    return false;
  }
}

export async function checkAnnouncerDeployed(announcerAddress: string): Promise<boolean> {
  try {
    return await verifyContractDeployed(announcerAddress);
  } catch {
    return false;
  }
}

/**
 * Read stealth meta-address from ERC-6538 registry
 * Returns null if not registered / empty
 */
export async function readMetaAddress(
  registryAddress: string,
  userAddress: string,
  schemeId: bigint = BigInt(1)
): Promise<StealthMetaAddress | null> {
  try {
    const data = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: 'stealthMetaAddressOf',
      args: [userAddress as `0x${string}`, schemeId],
    });

    const result = await callContract(registryAddress, data);
    if (!result || result === '0x' || result.length < 10) {
      return null;
    }

    const decoded = decodeFunctionResult({
      abi: REGISTRY_ABI,
      functionName: 'stealthMetaAddressOf',
      data: result as Hex,
    }) as Hex;

    if (!decoded || decoded === '0x' || decoded.length <= 2) {
      return null;
    }

    return bytesToMetaAddress(decoded);
  } catch (error) {
    console.error('Failed to read meta-address:', error);
    return null;
  }
}

/**
 * Register stealth meta-address on ERC-6538 registry via MetaMask
 */
export async function registerMetaAddress(
  registryAddress: string,
  from: string,
  meta: StealthMetaAddress,
  schemeId: bigint = BigInt(1)
): Promise<string> {
  const stealthMetaBytes = metaAddressToBytes(meta);
  const data = encodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: 'registerKeys',
    args: [schemeId, stealthMetaBytes],
  });

  return await sendContractTransaction(from, registryAddress, data);
}

/**
 * Publish announcement to ERC-5564 announcer
 */
export async function publishAnnouncement(
  announcerAddress: string,
  from: string,
  schemeId: bigint,
  stealthAddress: string,
  ephemeralPublicKey: string,
  metadata: string
): Promise<string> {
  const ephem = ephemeralPublicKey.startsWith('0x') ? ephemeralPublicKey : `0x${ephemeralPublicKey}`;
  const meta = metadata.startsWith('0x') ? metadata : `0x${metadata}`;
  const data = encodeFunctionData({
    abi: ANNOUNCER_ABI,
    functionName: 'announce',
    args: [
      schemeId,
      stealthAddress as `0x${string}`,
      ephem as Hex,
      meta as Hex,
    ],
  });
  return await sendContractTransaction(from, announcerAddress, data);
}

export async function scanAnnouncements(
  announcerAddress: string,
  fromBlock: number = 0
): Promise<
  Array<{
    schemeId: string;
    stealthAddress: string;
    ephemeralPublicKey: string;
    metadata: string;
    viewTag: number;
    txHash: string;
    blockNumber: string;
  }>
> {
  try {
    const fromBlockHex = '0x' + fromBlock.toString(16);
    const logs = await getLogs(announcerAddress, fromBlockHex, 'latest');

    return logs.flatMap((log: any) => {
      try {
        const decoded = decodeEventLog({
          abi: [ANNOUNCEMENT_EVENT],
          data: log.data as Hex,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        }) as {
          eventName: string;
          args: {
            schemeId: bigint;
            stealthAddress: string;
            ephemeralPubKey: Hex;
            metadata: Hex;
          };
        };
        if (decoded.eventName !== 'Announcement') return [];
        const args = decoded.args;
        return [
          {
            schemeId: args.schemeId.toString(),
            stealthAddress: args.stealthAddress,
            ephemeralPublicKey: args.ephemeralPubKey,
            metadata: args.metadata,
            viewTag: parseViewTagFromMetadata(args.metadata),
            txHash: log.transactionHash as string,
            blockNumber: log.blockNumber as string,
          },
        ];
      } catch {
        return [];
      }
    });
  } catch (error) {
    console.error('Failed to scan announcements:', error);
    return [];
  }
}

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
