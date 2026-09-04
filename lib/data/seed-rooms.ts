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
    category: 'Science & Technology',
    tags: ['Ethereum', 'Privacy', 'Web3'],
    viewers: 847,
    thumbnail: '/placeholder-tech.jpg',
    isLive: true,
    isFeatured: true,
    isDemoSeed: true
  },
  {
    id: 'room-2',
    title: 'Stealth addresses deep dive: ERC-5564 explained',
    host: '0x1234567890123456789012345678901234567890',
    category: 'Science & Technology',
    tags: ['Ethereum', 'Privacy', 'Tutorial'],
    viewers: 623,
    thumbnail: '/placeholder-privacy.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-3',
    title: 'Live coding: Decentralized streaming protocol',
    host: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    category: 'Software Development',
    tags: ['Coding', 'Web3', 'Live'],
    viewers: 412,
    thumbnail: '/placeholder-code.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-4',
    title: 'zkProofs for beginners - Interactive workshop',
    host: '0x9876543210987654321098765432109876543210',
    category: 'Science & Technology',
    tags: ['zkProofs', 'Tutorial', 'Workshop'],
    viewers: 389,
    thumbnail: '/placeholder-zk.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-5',
    title: 'DeFi alpha: hidden gems discussion',
    host: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    category: 'Finance',
    tags: ['DeFi', 'Trading', 'Discussion'],
    viewers: 267,
    thumbnail: '/placeholder-defi.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-6',
    title: 'NFT art session: generative on-chain',
    host: '0xc0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff',
    category: 'Art',
    tags: ['NFT', 'Art', 'Creative'],
    viewers: 156,
    thumbnail: '/placeholder-art.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-7',
    title: 'Hackathon final presentations - Judging live',
    host: '0x1111111111111111111111111111111111111111',
    category: 'Events',
    tags: ['Hackathon', 'Live', 'Community'],
    viewers: 1243,
    thumbnail: '/placeholder-event.jpg',
    isLive: true,
    isDemoSeed: true
  },
  {
    id: 'room-8',
    title: 'AMA: Building the next generation of privacy tech',
    host: '0x2222222222222222222222222222222222222222',
    category: 'Community',
    tags: ['AMA', 'Privacy', 'Discussion'],
    viewers: 534,
    thumbnail: '/placeholder-ama.jpg',
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
