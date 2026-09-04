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

export interface UseAnnouncementScannerOptions {
  identity: StealthIdentity | null;
  enabled: boolean;
  intervalMs?: number;
  fromBlock?: number;
  onPaymentDetected?: (payment: MatchedPayment) => void;
}

export function useAnnouncementScanner({
  identity,
  enabled,
  intervalMs = 30000,
  fromBlock = 0,
  onPaymentDetected,
}: UseAnnouncementScannerOptions) {
  const [state, setState] = useState<ScannerState>({
    isScanning: false,
    lastScannedBlock: fromBlock,
    matchedPayments: [],
    error: null,
  });

  const watcherRef = useRef<AnnouncementWatcher | null>(null);
  const onPaymentDetectedRef = useRef(onPaymentDetected);

  // Keep callback ref up to date
  useEffect(() => {
    onPaymentDetectedRef.current = onPaymentDetected;
  }, [onPaymentDetected]);

  const handleMatch = useCallback((payments: MatchedPayment[]) => {
    setState(prev => ({
      ...prev,
      matchedPayments: [...prev.matchedPayments, ...payments],
    }));

    // Notify for each payment
    payments.forEach(payment => {
      onPaymentDetectedRef.current?.(payment);
    });
  }, []);

  useEffect(() => {
    // Clean up previous watcher
    if (watcherRef.current) {
      watcherRef.current.stop();
      watcherRef.current = null;
    }

    // Start new watcher if enabled and identity is available
    if (enabled && identity) {
      try {
        const watcher = new AnnouncementWatcher(identity, intervalMs);
        watcher.onMatch(handleMatch);
        watcher.start(fromBlock);

        watcherRef.current = watcher;

        setState(prev => ({
          ...prev,
          isScanning: true,
          error: null,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start scanner';
        setState(prev => ({
          ...prev,
          isScanning: false,
          error: errorMessage,
        }));
      }
    } else {
      setState(prev => ({
        ...prev,
        isScanning: false,
      }));
    }

    // Cleanup on unmount
    return () => {
      if (watcherRef.current) {
        watcherRef.current.stop();
        watcherRef.current = null;
      }
    };
  }, [enabled, identity, intervalMs, fromBlock, handleMatch]);

  const clearPayments = useCallback(() => {
    setState(prev => ({
      ...prev,
      matchedPayments: [],
    }));
  }, []);

  return {
    ...state,
    clearPayments,
  };
}
