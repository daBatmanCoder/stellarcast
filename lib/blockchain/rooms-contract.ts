/**
 * StellaCast Rooms Contract Interactions
 * Mint room NFTs on Go Live, read room list for Browse
 */

import { encodeFunctionData, decodeFunctionResult, decodeEventLog, parseAbi, parseAbiItem, toEventSelector, type Hex } from 'viem';
import { callContract, sendContractTransaction, waitForTransactionReceipt, parseBlockNumber, getLogs } from './transactions';
import type { LiveRoom } from '@/lib/storage/rooms-store';

/**
 * Deployed StellaCast Rooms contract address on Sepolia
 * 
 * Live registry: 0x938B1E2E531817EACb8555F8Fc3a2e868e4FB3a5
 * Deploy tx: 0x4ebeb0c23d04587691d8bda3d2779914d6a52586fc45bc6e58a7d8d088412f73
 * Deploy block: 11633926
 * Abandoned: 0x4D34702b7967272adba2A361766cC461CF72f60a
 */
export const ROOM_CONTRACT_ADDRESS = '0x938B1E2E531817EACb8555F8Fc3a2e868e4FB3a5';
const ROOM_DEPLOY_BLOCK = 11_633_926;

const ROOMS_ABI = parseAbi([
  'function createRoom(string hostEns, string title, string category, string tags, string stealthMetaAddress, string thumbnail, uint256 entryPrice, bytes encryptedAccessData) returns (uint256)',
  'function endRoom(uint256 tokenId)',
  'function getRoomMetadata(uint256 tokenId) view returns ((uint256 tokenId, address host, string hostEns, string title, string category, string tags, string stealthMetaAddress, string thumbnail, uint256 entryPrice, bool isLive, bool burned, uint256 createdAt, uint256 endedAt))',
  'function getEncryptedAccessData(uint256 tokenId) view returns (bytes)',
  'function getLiveRoomIds() view returns (uint256[])',
  'function getAllRoomIds() view returns (uint256[])',
  'function getRoomsByHost(address host) view returns (uint256[])',
  'function getTotalRooms() view returns (uint256)',
  'function getLiveRoomCount() view returns (uint256)',
  'function roomExists(uint256 tokenId) view returns (bool)',
  'function isJoinable(uint256 tokenId) view returns (bool)',
]);

const ROOM_CREATED_EVENT = parseAbiItem(
  'event RoomCreated(uint256 indexed tokenId, address indexed host, string hostEns, string title, string category, string stealthMetaAddress, uint256 entryPrice, uint256 createdAt)'
);

export interface CreateRoomParams {
  hostEns: string;
  title: string;
  category: string;
  tags: string[]; // will be joined with commas
  stealthMetaAddress: string;
  thumbnail?: string;
  entryPrice?: string; // ETH amount, defaults to 0.001
  encryptedAccessData: string; // hex string of encrypted credentials
}

/**
 * Create a room on-chain (mint room NFT)
 * Called when host goes live
 */
export async function createRoomOnChain(
  fromAddress: string,
  params: CreateRoomParams
): Promise<{ txHash: string; tokenId?: number; blockNumber?: number }> {
  const tagsString = params.tags.join(',');
  const entryPriceWei = BigInt(Math.floor(parseFloat(params.entryPrice || '0.001') * 1e18));
  const thumbnail = params.thumbnail || '';
  
  // encryptedAccessData should be hex string starting with 0x
  const accessDataHex = params.encryptedAccessData.startsWith('0x') 
    ? params.encryptedAccessData 
    : `0x${params.encryptedAccessData}`;

  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'createRoom',
    args: [
      params.hostEns,
      params.title,
      params.category,
      tagsString,
      params.stealthMetaAddress,
      thumbnail,
      entryPriceWei,
      accessDataHex as Hex,
    ],
  });

  const txHash = await sendContractTransaction(fromAddress, ROOM_CONTRACT_ADDRESS, data);
  const receipt = await waitForTransactionReceipt(txHash);
  const tokenId = parseRoomCreatedTokenId(receipt.logs);

  return { txHash, tokenId, blockNumber: parseBlockNumber(receipt.blockNumber) };
}

function parseRoomCreatedTokenId(
  logs?: Array<{ address: string; topics: string[]; data: string }>
): number | undefined {
  if (!logs?.length) return undefined;

  for (const log of logs) {
    if (log.address.toLowerCase() !== ROOM_CONTRACT_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [ROOM_CREATED_EVENT],
        data: log.data as Hex,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      }) as { eventName: string; args: { tokenId: bigint } };
      if (decoded.eventName === 'RoomCreated') {
        return Number(decoded.args.tokenId);
      }
    } catch {
      if (log.topics[1]) {
        return Number(BigInt(log.topics[1]));
      }
    }
  }
  return undefined;
}

export async function endRoomOnChain(
  fromAddress: string,
  tokenId: number
): Promise<string> {
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'endRoom',
    args: [BigInt(tokenId)],
  });

  const txHash = await sendContractTransaction(fromAddress, ROOM_CONTRACT_ADDRESS, data);
  await waitForTransactionReceipt(txHash);
  return txHash;
}

/**
 * Get room metadata from chain
 */
type RoomMetadataOnChain = {
  tokenId: number;
  host: string;
  hostEns: string;
  title: string;
  category: string;
  tags: string[];
  stealthMetaAddress: string;
  thumbnail: string;
  entryPrice: string;
  isLive: boolean;
  burned: boolean;
  createdAt: number;
  endedAt: number;
};

export async function getRoomMetadata(tokenId: number): Promise<RoomMetadataOnChain | null> {
  try {
    const data = encodeFunctionData({
      abi: ROOMS_ABI,
      functionName: 'getRoomMetadata',
      args: [BigInt(tokenId)],
    });

    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    if (!result || result === '0x') return null;

    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'getRoomMetadata',
      data: result as Hex,
    }) as {
      tokenId: bigint;
      host: string;
      hostEns: string;
      title: string;
      category: string;
      tags: string;
      stealthMetaAddress: string;
      thumbnail: string;
      entryPrice: bigint;
      isLive: boolean;
      burned: boolean;
      createdAt: bigint;
      endedAt: bigint;
    };

    if (Number(decoded.createdAt) === 0) return null;

    return {
      tokenId: Number(decoded.tokenId),
      host: decoded.host,
      hostEns: decoded.hostEns,
      title: decoded.title,
      category: decoded.category,
      tags: decoded.tags ? decoded.tags.split(',').filter(Boolean) : [],
      stealthMetaAddress: decoded.stealthMetaAddress,
      thumbnail: decoded.thumbnail,
      entryPrice: (Number(decoded.entryPrice) / 1e18).toString(),
      isLive: decoded.isLive && !decoded.burned,
      burned: decoded.burned,
      createdAt: Number(decoded.createdAt),
      endedAt: Number(decoded.endedAt),
    };
  } catch (error) {
    console.error('Failed to get room metadata:', error);
    return null;
  }
}

function metadataToLiveRoom(
  metadata: RoomMetadataOnChain,
  createdBlocks: Map<number, number>
): LiveRoom {
  return {
    id: `room-${metadata.tokenId}`,
    title: metadata.title,
    host: metadata.host,
    hostDisplayName: metadata.hostEns,
    category: metadata.category,
    tags: metadata.tags,
    viewers: 0,
    thumbnail: metadata.thumbnail || `/thumbnails/room-${metadata.tokenId % 8 + 1}.svg`,
    isLive: metadata.isLive,
    burned: metadata.burned,
    createdAt: metadata.createdAt * 1000,
    endedAt: metadata.endedAt > 0 ? metadata.endedAt * 1000 : undefined,
    createdBlock: createdBlocks.get(metadata.tokenId),
    stealthMetaAddress: metadata.stealthMetaAddress || undefined,
  };
}

/**
 * Get encrypted access data for a room
 * Viewer needs password (derived from stealth payment) to decrypt this
 */
export async function getEncryptedAccessData(tokenId: number): Promise<string | null> {
  try {
    const data = encodeFunctionData({
      abi: ROOMS_ABI,
      functionName: 'getEncryptedAccessData',
      args: [BigInt(tokenId)],
    });

    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    if (!result || result === '0x') return null;

    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'getEncryptedAccessData',
      data: result as Hex,
    }) as Hex;

    return decoded;
  } catch (error) {
    console.error('Failed to get encrypted access data:', error);
    return null;
  }
}

/**
 * Get all room IDs from chain
 */
async function getRoomCreatedBlocks(): Promise<Map<number, number>> {
  const blocks = new Map<number, number>();
  try {
    const topic = toEventSelector(ROOM_CREATED_EVENT);
    const fromBlock = '0x' + ROOM_DEPLOY_BLOCK.toString(16);
    const logs = await getLogs(ROOM_CONTRACT_ADDRESS, fromBlock, 'latest', [topic]) as Array<{
      topics: string[];
      blockNumber: string;
    }>;

    for (const log of logs) {
      const tokenId = log.topics[1] ? Number(BigInt(log.topics[1])) : NaN;
      const block = parseBlockNumber(log.blockNumber);
      if (Number.isFinite(tokenId) && block !== undefined) {
        blocks.set(tokenId, block);
      }
    }
  } catch (error) {
    console.warn('Could not load RoomCreated blocks:', error);
  }
  return blocks;
}

export function parseRoomTokenId(roomId: string): number | undefined {
  const match = /^room-(\d+)$/.exec(roomId);
  if (!match) return undefined;
  const tokenId = Number(match[1]);
  return Number.isFinite(tokenId) ? tokenId : undefined;
}

async function getRoomIds(functionName: 'getLiveRoomIds' | 'getAllRoomIds'): Promise<number[]> {
  try {
    const data = encodeFunctionData({
      abi: ROOMS_ABI,
      functionName,
      args: [],
    });

    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    if (!result || result === '0x') return [];

    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName,
      data: result as Hex,
    }) as bigint[];

    return decoded.map(id => Number(id));
  } catch (error) {
    console.error(`Failed to get room IDs via ${functionName}:`, error);
    return [];
  }
}

export async function getAllRoomIds(): Promise<number[]> {
  return getRoomIds('getAllRoomIds');
}

export async function getLiveRoomIds(): Promise<number[]> {
  return getRoomIds('getLiveRoomIds');
}

/**
 * Get all live rooms (for Browse page)
 * Reads public metadata from chain
 */
export async function getAllRooms(): Promise<LiveRoom[]> {
  try {
    const roomIds = await getLiveRoomIds();
    if (roomIds.length === 0) return [];

    const createdBlocks = await getRoomCreatedBlocks();
    const rooms: LiveRoom[] = [];

    for (const tokenId of roomIds) {
      const metadata = await getRoomMetadata(tokenId);
      if (!metadata || !metadata.isLive || metadata.burned) continue;
      rooms.push(metadataToLiveRoom(metadata, createdBlocks));
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to get all rooms:', error);
    return [];
  }
}

/**
 * Get rooms created by specific host
 */
export async function getRoomsByHost(hostAddress: string): Promise<LiveRoom[]> {
  try {
    const data = encodeFunctionData({
      abi: ROOMS_ABI,
      functionName: 'getRoomsByHost',
      args: [hostAddress as `0x${string}`],
    });

    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    if (!result || result === '0x') return [];

    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'getRoomsByHost',
      data: result as Hex,
    }) as bigint[];

    const tokenIds = decoded.map(id => Number(id));
    const createdBlocks = await getRoomCreatedBlocks();
    const rooms: LiveRoom[] = [];

    for (const tokenId of tokenIds) {
      const metadata = await getRoomMetadata(tokenId);
      if (!metadata) continue;

      rooms.push(metadataToLiveRoom(metadata, createdBlocks));
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to get rooms by host:', error);
    return [];
  }
}
