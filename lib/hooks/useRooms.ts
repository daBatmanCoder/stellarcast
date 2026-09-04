/**
 * React hook to load live rooms from on-chain NFT registry
 */

import { useState, useEffect } from 'react';
import { getAllRooms } from '@/lib/blockchain/rooms-contract';
import type { LiveRoom } from '@/lib/data/seed-rooms';

export function useRooms() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedRooms = await getAllRooms();
      setRooms(fetchedRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return {
    rooms,
    loading,
    error,
    reload: loadRooms,
  };
}
