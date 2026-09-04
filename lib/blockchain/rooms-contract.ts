/**
 * StellaCast Rooms Contract Interactions
 * Mint room NFTs on Go Live, read room list for Browse
 */

import { encodeFunctionData, decodeFunctionResult, decodeEventLog, parseAbi, parseAbiItem, type Hex } from 'viem';
import { callContract, sendContractTransaction, waitForTransactionReceipt } from './transactions';
import type { LiveRoom } from '@/lib/storage/rooms-store';

/**
 * Deployed StellaCast Rooms contract address on Sepolia
 * 
 * DEPLOYMENT STATUS: DEPLOYED ✅
 * 
 * Contract: 0x4D34702b7967272adba2A361766cC461CF72f60a
 * Deploy Tx: 0xee0266d005020adb19d4b54a88ece95a0f67439c6a0c6810bd70cfcfa342097f
 * Deployer: 0xD0a2b03fCCAD184B9eec286FeFA34301E9436206
 * Etherscan: https://sepolia.etherscan.io/address/0x4D34702b7967272adba2A361766cC461CF72f60a
 */
export const ROOM_CONTRACT_ADDRESS = '0x4D34702b7967272adba2A361766cC461CF72f60a';

const ROOMS_ABI = parseAbi([
  'function createRoom(string hostEns, string title, string category, string tags, string stealthMetaAddress, string thumbnail, uint256 entryPrice, bytes encryptedAccessData) returns (uint256)',
  'function updateRoomStatus(uint256 tokenId, bool isLive)',
  'function getRoomMetadata(uint256 tokenId) view returns (uint256, address, string, string, string, string, string, string, uint256, bool, uint256)',
  'function getEncryptedAccessData(uint256 tokenId) view returns (bytes)',
  'function getAllRoomIds() view returns (uint256[])',
  'function getRoomsByHost(address host) view returns (uint256[])',
  'function getTotalRooms() view returns (uint256)',
  'function roomExists(uint256 tokenId) view returns (bool)',
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
): Promise<{ txHash: string; tokenId?: number }> {
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

  return { txHash, tokenId };
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

/**
 * Update room live status
 */
export async function updateRoomStatusOnChain(
  fromAddress: string,
  tokenId: number,
  isLive: boolean
): Promise<string> {
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'updateRoomStatus',
    args: [BigInt(tokenId), isLive],
  });

  return await sendContractTransaction(fromAddress, ROOM_CONTRACT_ADDRESS, data);
}

/**
 * Get room metadata from chain
 */
export async function getRoomMetadata(tokenId: number): Promise<{
  tokenId: number;
  host: string;
  hostEns: string;
  title: string;
  category: string;
  tags: string[];
  stealthMetaAddress: string;
  thumbnail: string;
  entryPrice: string; // ETH amount
  isLive: boolean;
  createdAt: number;
} | null> {
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
    }) as any;

    const [
      tokenIdBig,
      host,
      hostEns,
      title,
      category,
      tagsString,
      stealthMetaAddress,
      thumbnail,
      entryPriceBig,
      isLive,
      createdAtBig,
    ] = decoded;

    return {
      tokenId: Number(tokenIdBig),
      host,
      hostEns,
      title,
      category,
      tags: tagsString ? tagsString.split(',').filter(Boolean) : [],
      stealthMetaAddress,
      thumbnail,
      entryPrice: (Number(entryPriceBig) / 1e18).toString(),
      isLive,
      createdAt: Number(createdAtBig),
    };
  } catch (error) {
    console.error('Failed to get room metadata:', error);
    return null;
  }
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
export async function getAllRoomIds(): Promise<number[]> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return [];
    }
    const data = encodeFunctionData({
      abi: ROOMS_ABI,
      functionName: 'getAllRoomIds',
      args: [],
    });

    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    if (!result || result === '0x') return [];

    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'getAllRoomIds',
      data: result as Hex,
    }) as bigint[];

    return decoded.map(id => Number(id));
  } catch (error) {
    console.error('Failed to get all room IDs:', error);
    return [];
  }
}

/**
 * Get all live rooms (for Browse page)
 * Reads public metadata from chain
 */
export async function getAllRooms(): Promise<LiveRoom[]> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return [];
    }
    const roomIds = await getAllRoomIds();
    if (roomIds.length === 0) return [];

    const rooms: LiveRoom[] = [];

    for (const tokenId of roomIds) {
      const metadata = await getRoomMetadata(tokenId);
      if (!metadata) continue;

      rooms.push({
        id: `room-${tokenId}`,
        title: metadata.title,
        host: metadata.host,
        hostDisplayName: metadata.hostEns,
        category: metadata.category,
        tags: metadata.tags,
        viewers: 0, // Real viewer count would come from separate tracking
        thumbnail: metadata.thumbnail || `/thumbnails/room-${tokenId % 8 + 1}.svg`,
        isLive: metadata.isLive,
        isFeatured: false,
        createdAt: metadata.createdAt * 1000, // convert to ms
        stealthMetaAddress: metadata.stealthMetaAddress,
      });
    }

    // Return live rooms first, newest first
    return rooms
      .filter(r => r.isLive)
      .sort((a, b) => b.createdAt - a.createdAt);
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
    const rooms: LiveRoom[] = [];

    for (const tokenId of tokenIds) {
      const metadata = await getRoomMetadata(tokenId);
      if (!metadata) continue;

      rooms.push({
        id: `room-${tokenId}`,
        title: metadata.title,
        host: metadata.host,
        hostDisplayName: metadata.hostEns,
        category: metadata.category,
        tags: metadata.tags,
        viewers: 0,
        thumbnail: metadata.thumbnail || `/thumbnails/room-${tokenId % 8 + 1}.svg`,
        isLive: metadata.isLive,
        isFeatured: false,
        createdAt: metadata.createdAt * 1000,
        stealthMetaAddress: metadata.stealthMetaAddress,
      });
    }

    return rooms.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to get rooms by host:', error);
    return [];
  }
}
