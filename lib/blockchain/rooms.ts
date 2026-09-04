/**
 * StellaCast Rooms NFT contract interactions
 * Contract: StellaCastRooms on Sepolia at 0x4D34702b7967272adba2A361766cC461CF72f60a
 */

import {
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  type Hex,
} from 'viem';
import { 
  sendContractTransaction, 
  callContract, 
  verifyContractDeployed 
} from './transactions';

/**
 * StellaCast Rooms contract address on Sepolia
 */
export const ROOM_CONTRACT_ADDRESS = '0x4D34702b7967272adba2A361766cC461CF72f60a';

/**
 * StellaCastRooms contract ABI (subset for room creation)
 */
const ROOMS_ABI = parseAbi([
  'function createRoom(string title, string category, bytes encryptedAccess) returns (uint256)',
  'function getRoomInfo(uint256 tokenId) view returns (address owner, string title, string category, bytes encryptedAccess)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

/**
 * Verify the StellaCastRooms contract is deployed
 */
export async function checkRoomContractDeployed(): Promise<boolean> {
  try {
    return await verifyContractDeployed(ROOM_CONTRACT_ADDRESS);
  } catch {
    return false;
  }
}

/**
 * Create a new room NFT on-chain
 * @param from - Host wallet address
 * @param title - Room title
 * @param category - Room category
 * @param encryptedAccessData - Encrypted room access data (properly formatted as hex bytes)
 * @returns Transaction hash
 */
export async function createRoomOnChain(
  from: string,
  title: string,
  category: string,
  encryptedAccessData: Hex
): Promise<string> {
  // Validate inputs
  if (!title || title.trim().length === 0) {
    throw new Error('Room title is required');
  }
  
  if (!category || category.trim().length === 0) {
    throw new Error('Room category is required');
  }

  // Ensure encrypted data is valid hex
  if (!encryptedAccessData.startsWith('0x')) {
    throw new Error('Encrypted access data must be hex string starting with 0x');
  }

  // Check contract is deployed
  const isDeployed = await checkRoomContractDeployed();
  if (!isDeployed) {
    throw new Error('StellaCastRooms contract is not deployed at ' + ROOM_CONTRACT_ADDRESS);
  }

  // Encode the function call
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'createRoom',
    args: [title, category, encryptedAccessData],
  });

  try {
    // Send transaction
    const txHash = await sendContractTransaction(from, ROOM_CONTRACT_ADDRESS, data);
    return txHash;
  } catch (error: unknown) {
    // Enhance error messages
    if (error instanceof Error) {
      if (error.message.includes('rejected') || error.message.includes('denied')) {
        throw new Error('Transaction rejected by user');
      }
      if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds for gas');
      }
      if (error.message.includes('revert')) {
        throw new Error('Contract reverted: ' + error.message);
      }
      throw new Error('Failed to create room: ' + error.message);
    }
    throw new Error('Failed to create room: Unknown error');
  }
}

/**
 * Call createRoom via eth_call to estimate/test without sending transaction
 * Returns the token ID that would be minted
 */
export async function estimateCreateRoom(
  from: string,
  title: string,
  category: string,
  encryptedAccessData: Hex
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'createRoom',
    args: [title, category, encryptedAccessData],
  });

  try {
    const result = await callContract(ROOM_CONTRACT_ADDRESS, data, from);
    
    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'createRoom',
      data: result as Hex,
    }) as bigint;

    return decoded;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error('Failed to estimate room creation: ' + error.message);
    }
    throw new Error('Failed to estimate room creation');
  }
}

/**
 * Get room info by token ID
 */
export async function getRoomInfo(tokenId: bigint): Promise<{
  owner: string;
  title: string;
  category: string;
  encryptedAccess: Hex;
} | null> {
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'getRoomInfo',
    args: [tokenId],
  });

  try {
    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    
    const decoded = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'getRoomInfo',
      data: result as Hex,
    }) as [string, string, string, Hex];

    return {
      owner: decoded[0],
      title: decoded[1],
      category: decoded[2],
      encryptedAccess: decoded[3],
    };
  } catch (error) {
    console.error('Failed to get room info:', error);
    return null;
  }
}

/**
 * Get the owner of a room NFT
 */
export async function getRoomOwner(tokenId: bigint): Promise<string | null> {
  const data = encodeFunctionData({
    abi: ROOMS_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  });

  try {
    const result = await callContract(ROOM_CONTRACT_ADDRESS, data);
    
    const owner = decodeFunctionResult({
      abi: ROOMS_ABI,
      functionName: 'ownerOf',
      data: result as Hex,
    }) as string;

    return owner;
  } catch (error) {
    console.error('Failed to get room owner:', error);
    return null;
  }
}
