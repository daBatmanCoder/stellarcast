/**
 * Live Rooms Registry
 * Stores real user-created rooms in IndexedDB
 * 
 * PRODUCTION UPGRADE PATH:
 * For cross-user discovery on static GitHub Pages, consider:
 * 1. On-chain registry contract: Emit RoomCreated events on Sepolia
 * 2. Client-side event indexing: Query past events to build room list
 * 3. ENS text records: Store room announcements per-host
 * 4. IPFS/Ceramic: Decentralized data layer for room metadata
 * 
 * Current implementation: IndexedDB (per-device), demonstrates UX flow
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface LiveRoom {
  id: string;
  title: string;
  host: string; // Ethereum address
  hostDisplayName?: string; // ENS if available
  category: string;
  tags: string[];
  viewers: number;
  thumbnail: string;
  isLive: boolean;
  isFeatured?: boolean;
  createdAt: number;
  createdBlock?: number;
  stealthMetaAddress?: string; // Host's stealth meta-address for payments
}

interface RoomsDB extends DBSchema {
  rooms: {
    key: string; // room id
    value: LiveRoom;
    indexes: {
      'by-host': string;
      'by-created': number;
      'by-live': number; // 1 for live, 0 for offline
    };
  };
}

let db: IDBPDatabase<RoomsDB> | null = null;

async function initDB(): Promise<void> {
  if (db) return;

  db = await openDB<RoomsDB>('stellarcast-rooms', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('rooms')) {
        const store = database.createObjectStore('rooms', { keyPath: 'id' });
        store.createIndex('by-host', 'host', { unique: false });
        store.createIndex('by-created', 'createdAt', { unique: false });
        store.createIndex('by-live', 'isLive', { unique: false });
      }
    },
  });
}

/**
 * Create a new live room (called when host goes live)
 */
export async function createRoom(room: Omit<LiveRoom, 'id' | 'createdAt'>): Promise<LiveRoom> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const newRoom: LiveRoom = {
    ...room,
    id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  };

  await db.put('rooms', newRoom);
  return newRoom;
}

/**
 * Get all live rooms (for browse page)
 */
export async function getLiveRooms(): Promise<LiveRoom[]> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const tx = db.transaction('rooms', 'readonly');
  const index = tx.store.index('by-created');
  const allRooms = await index.getAll();

  // Return only live rooms, newest first
  return allRooms
    .filter(room => room.isLive)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get a specific room by ID
 */
export async function getRoom(roomId: string): Promise<LiveRoom | null> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const room = await db.get('rooms', roomId);
  return room || null;
}

/**
 * Update room status (e.g., mark as offline)
 */
export async function updateRoomStatus(roomId: string, isLive: boolean): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const room = await db.get('rooms', roomId);
  if (!room) return;

  room.isLive = isLive;
  await db.put('rooms', room);
}

/**
 * Update room viewer count
 */
export async function updateViewerCount(roomId: string, viewers: number): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const room = await db.get('rooms', roomId);
  if (!room) return;

  room.viewers = viewers;
  await db.put('rooms', room);
}

/**
 * Get rooms by host address
 */
export async function getRoomsByHost(hostAddress: string): Promise<LiveRoom[]> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const tx = db.transaction('rooms', 'readonly');
  const index = tx.store.index('by-host');
  return await index.getAll(hostAddress.toLowerCase());
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  await db.delete('rooms', roomId);
}

/**
 * Clear all rooms (for testing/demo reset)
 */
export async function clearAllRooms(): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const tx = db.transaction('rooms', 'readwrite');
  await tx.store.clear();
}
