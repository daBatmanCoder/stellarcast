/**
 * React hook for scanning ERC-5564 announcements in live rooms
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { StealthIdentity } from '@/lib/types/stealth';
import {
  AnnouncementWatcher,
  type MatchedPayment,
  type ScannerState,
} from '@/lib/stealth/announcement-watcher';
import { getBlockNumber } from '@/lib/blockchain/transactions';

export interface UseAnnouncementScannerOptions {
  identity: StealthIdentity | null;
  enabled: boolean;
  intervalMs?: number;
  fromBlock?: number;
  excludeCaller?: string;
  onPaymentDetected?: (payment: MatchedPayment) => void;
}

export function useAnnouncementScanner({
  identity,
  enabled,
  intervalMs = 30000,
  fromBlock,
  excludeCaller,
  onPaymentDetected,
}: UseAnnouncementScannerOptions) {
  const [state, setState] = useState<ScannerState>({
    isScanning: false,
    lastScannedBlock: fromBlock ?? 0,
    matchedPayments: [],
    error: null,
  });

  const watcherRef = useRef<AnnouncementWatcher | null>(null);
  const onPaymentDetectedRef = useRef(onPaymentDetected);
  const seenHashesRef = useRef(new Set<string>());

  useEffect(() => {
    onPaymentDetectedRef.current = onPaymentDetected;
  }, [onPaymentDetected]);

  const handleMatch = useCallback((payments: MatchedPayment[]) => {
    const unique = payments.filter((payment) => {
      const hash = payment.announcement.txHash;
      if (seenHashesRef.current.has(hash)) return false;
      seenHashesRef.current.add(hash);
      return true;
    });

    if (unique.length === 0) return;

    setState((prev) => ({
      ...prev,
      matchedPayments: [...prev.matchedPayments, ...unique],
    }));

    unique.forEach((payment) => {
      onPaymentDetectedRef.current?.(payment);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (watcherRef.current) {
      watcherRef.current.stop();
      watcherRef.current = null;
    }

    if (!enabled || !identity) {
      setState((prev) => ({
        ...prev,
        isScanning: false,
      }));
      return;
    }

    const start = async () => {
      try {
        let startBlock = fromBlock;
        if (startBlock == null || !Number.isFinite(startBlock)) {
          startBlock = await getBlockNumber();
        }
        if (cancelled) return;

        const watcher = new AnnouncementWatcher(identity, intervalMs, { excludeCaller });
        watcher.onMatch(handleMatch);
        watcher.start(startBlock);
        watcherRef.current = watcher;

        setState((prev) => ({
          ...prev,
          isScanning: true,
          lastScannedBlock: startBlock,
          error: null,
        }));
      } catch (error) {
        if (cancelled) return;
        const errorMessage = error instanceof Error ? error.message : 'Failed to start scanner';
        setState((prev) => ({
          ...prev,
          isScanning: false,
          error: errorMessage,
        }));
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (watcherRef.current) {
        watcherRef.current.stop();
        watcherRef.current = null;
      }
    };
  }, [enabled, identity, intervalMs, fromBlock, excludeCaller, handleMatch]);

  const clearPayments = useCallback(() => {
    seenHashesRef.current.clear();
    setState((prev) => ({
      ...prev,
      matchedPayments: [],
    }));
  }, []);

  return {
    ...state,
    clearPayments,
  };
}
