/**
 * Demo Seed Data for Live Rooms
 * Labeled as demo/seed for hackathon presentation
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
  isFeatured?: boolean;
  isDemoSeed: boolean;
}

/**
 * Seed rooms for demo
 * These are demo rooms for presentation - marked as such in UI
 */
export const SEED_ROOMS: LiveRoom[] = [
  {
    id: 'room-1',
    title: 'Building the future of privacy-preserving payments',
    host: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    hostDisplayName: 'privacy.eth',
    category: 'Science & Technology',
    tags: ['Ethereum', 'Privacy', 'Web3'],
    viewers: 847,
    thumbnail: '/thumbnails/room-1.svg',
    isLive: true,
    isFeatured: true,
    isDemoSeed: true
  },
  {
    id: 'room-2',
    title: 'Stealth addresses deep dive: ERC-5564 explained',
    host: '0x1234567890123456789012345678901234567890',
    hostDisplayName: 'stealth.dev',
    category: 'Science & Technology',
    tags: ['Ethereum', 'Privacy', 'Tutorial'],
    viewers: 623,
    thumbnail: '/thumbnails/room-2.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-3',
    title: 'Live coding: Decentralized streaming protocol',
    host: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    hostDisplayName: 'streamcoder.eth',
    category: 'Software Development',
    tags: ['Coding', 'Web3', 'Live'],
    viewers: 412,
    thumbnail: '/thumbnails/room-3.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-4',
    title: 'zkProofs for beginners - Interactive workshop',
    host: '0x9876543210987654321098765432109876543210',
    hostDisplayName: 'zkshop.eth',
    category: 'Science & Technology',
    tags: ['zkProofs', 'Tutorial', 'Workshop'],
    viewers: 389,
    thumbnail: '/thumbnails/room-4.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-5',
    title: 'DeFi alpha: hidden gems discussion',
    host: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    hostDisplayName: 'alpha.eth',
    category: 'Finance',
    tags: ['DeFi', 'Trading', 'Discussion'],
    viewers: 267,
    thumbnail: '/thumbnails/room-5.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-6',
    title: 'NFT art session: generative on-chain',
    host: '0xc0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff',
    hostDisplayName: 'onchainart.eth',
    category: 'Art',
    tags: ['NFT', 'Art', 'Creative'],
    viewers: 156,
    thumbnail: '/thumbnails/room-6.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-7',
    title: 'Hackathon final presentations - Judging live',
    host: '0x1111111111111111111111111111111111111111',
    hostDisplayName: 'hackhouse.eth',
    category: 'Events',
    tags: ['Hackathon', 'Live', 'Community'],
    viewers: 1243,
    thumbnail: '/thumbnails/room-7.svg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-8',
    title: 'AMA: Building the next generation of privacy tech',
    host: '0x2222222222222222222222222222222222222222',
    hostDisplayName: 'privacyama.eth',
    category: 'Community',
    tags: ['AMA', 'Privacy', 'Discussion'],
    viewers: 534,
    thumbnail: '/thumbnails/room-8.svg',
    isLive: true,
    isDemoSeed: true
  }
];

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

export function getCategoryStats(rooms: LiveRoom[] = SEED_ROOMS) {
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
