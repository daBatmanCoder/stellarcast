/**
 * Live Room Types and Utilities
 * 
 * ARCHITECTURE: Rooms are now stored as NFTs on-chain
 * - Public metadata: browseable without payment
 * - Encrypted access data: requires stealth payment to decrypt
 * 
 * See lib/blockchain/rooms-contract.ts for on-chain interactions
 */

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
  burned?: boolean;
  isFeatured?: boolean;
  createdAt: number; // timestamp in ms
  endedAt?: number; // timestamp in ms, set after endRoom
  createdBlock?: number; // Sepolia block when the room was minted
  stealthMetaAddress?: string; // host's stealth meta for payments
}

export const CATEGORIES = [
  'Science & Technology',
  'Software Development',
  'Finance',
  'Art',
  'Events',
  'Community',
  'Gaming',
  'Music'
];

const CATEGORY_POSTERS: Record<string, string> = {
  'Science & Technology': '/categories/science.svg',
  'Software Development': '/categories/software.svg',
  Finance: '/categories/finance.svg',
  Art: '/categories/art.svg',
  Events: '/categories/events.svg',
  Community: '/categories/community.svg',
  Gaming: '/categories/gaming.svg',
  Music: '/categories/music.svg',
};

export function getCategoryPoster(name: string): string {
  return CATEGORY_POSTERS[name] || '/categories/community.svg';
}

export function getCategoryStats(rooms: LiveRoom[] = []) {
  return CATEGORIES.map((name) => {
    const matching = rooms.filter((r) => r.category === name);
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      poster: getCategoryPoster(name),
      viewers: matching.reduce((sum, r) => sum + r.viewers, 0),
      tags: matching[0]?.tags?.slice(0, 2) || [name.split(' ')[0]],
      roomCount: matching.length,
    };
  });
}
