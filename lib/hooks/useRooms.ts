/**
 * React hook to load live rooms from on-chain NFT registry
 */

import { useState, useEffect, useCallback } from 'react';
import { getAllRooms } from '@/lib/blockchain/rooms-contract';
import type { LiveRoom } from '@/lib/data/seed-rooms';

const POLL_MS = 15000;

export function useRooms() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      const fetchedRooms = await getAllRooms();
      setRooms(fetchedRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
      if (!options?.silent) setRooms([]);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  const upsertRoom = useCallback((room: LiveRoom) => {
    setRooms((prev) => {
      const rest = prev.filter((existing) => existing.id !== room.id);
      const next = room.isLive ? [room, ...rest] : rest;
      return next.sort((a, b) => b.createdAt - a.createdAt);
    });
  }, []);

  useEffect(() => {
    void loadRooms();
    const id = setInterval(() => {
      void loadRooms({ silent: true });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadRooms]);

  return {
    rooms,
    loading,
    error,
    reload: loadRooms,
    upsertRoom,
  };
}
