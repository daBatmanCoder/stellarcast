'use client';

import { useState } from 'react';
import { formatEther, isAddress } from 'viem';
import { ModalShell } from './ModalShell';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconCheck, IconClose, IconCopy } from './ui/Icons';
import type { ReceivingStatus } from '@/lib/stealth/receiving';
import type { StealthIdentity } from '@/lib/types/stealth';
import { scanForHostPayments, type MatchedPayment } from '@/lib/stealth/announcement-watcher';
import { computeStealthPrivateKey, parseNativeEthAmount, parseStealthPaymentKind } from '@/lib/crypto/stealth';
import { getNativeBalance, sweepStealthEth } from '@/lib/blockchain/transactions';
import { ROOM_DEPLOY_BLOCK } from '@/lib/blockchain/rooms-contract';

interface CollectRow {
  payment: MatchedPayment;
  balanceWei: bigint;
  status: 'idle' | 'sweeping' | 'done' | 'error';
  detail: string;
}

interface ViewStealthAddressModalProps {
  isOpen: boolean;
  metaAddress: string;
  walletAddress: string;
  receivingStatus: ReceivingStatus;
  identity?: StealthIdentity | null;
  onClose: () => void;
}

export function ViewStealthAddressModal({
  isOpen,
  metaAddress,
  walletAddress,
  receivingStatus,
  identity = null,
  onClose,
}: ViewStealthAddressModalProps) {
  const [copied, setCopied] = useState(false);
  const [destination, setDestination] = useState('');
  const [rows, setRows] = useState<CollectRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [sweepingAll, setSweepingAll] = useState(false);
  const [collectError, setCollectError] = useState('');

  const handleCopy = async () => {
    if (!metaAddress) return;
    await navigator.clipboard.writeText(metaAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sameWallet = (value: string) =>
    !!walletAddress && value.toLowerCase() === walletAddress.toLowerCase();

  const parsedDestination = destination.trim();
  const destinationOk = isAddress(parsedDestination) && !sameWallet(parsedDestination);

  const handleScan = async () => {
    if (!identity) {
      setCollectError('Unlock payment keys first. Go Live or import recipient.json.');
      return;
    }
    setScanning(true);
    setCollectError('');
    try {
      const matches = await scanForHostPayments(identity, ROOM_DEPLOY_BLOCK, {
        excludeCaller: walletAddress || undefined,
      });
      const next: CollectRow[] = [];
      for (const payment of matches) {
        const already = next.some(
          (row) => row.payment.stealthAddress.toLowerCase() === payment.stealthAddress.toLowerCase()
        );
        if (already) continue;
        const balanceWei = await getNativeBalance(payment.stealthAddress);
        next.push({ payment, balanceWei, status: 'idle', detail: '' });
      }
      setRows(next);
      if (next.length === 0) {
        setCollectError('No stealth payments matched these keys in the current scan window.');
      }
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const sweepRow = async (row: CollectRow, index: number) => {
    if (!identity || !destinationOk) {
      throw new Error('Paste a fresh destination address — not this connected wallet');
    }
    if (row.balanceWei === BigInt(0)) {
      throw new Error('Nothing to sweep on this address');
    }
    const stealthKey = computeStealthPrivateKey(identity, row.payment.sharedSecret);
    const hash = await sweepStealthEth(stealthKey, parsedDestination as `0x${string}`);
    const left = await getNativeBalance(row.payment.stealthAddress);
    setRows((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, balanceWei: left, status: 'done', detail: hash }
          : item
      )
    );
  };

  const handleSweepOne = async (index: number) => {
    setCollectError('');
    setRows((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status: 'sweeping', detail: '' } : item))
    );
    try {
      await sweepRow(rows[index], index);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sweep failed';
      setRows((prev) =>
        prev.map((item, i) => (i === index ? { ...item, status: 'error', detail: message } : item))
      );
    }
  };

  const handleSweepAll = async () => {
    if (!destinationOk) {
      setCollectError('Paste a fresh destination address — not this connected wallet');
      return;
    }
    setSweepingAll(true);
    setCollectError('');
    const snapshot = rows;
    try {
      for (let i = 0; i < snapshot.length; i += 1) {
        if (snapshot[i].balanceWei === BigInt(0)) continue;
        setRows((prev) =>
          prev.map((item, index) => (index === i ? { ...item, status: 'sweeping', detail: '' } : item))
        );
        await sweepRow(snapshot[i], i);
      }
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : 'Sweep failed');
    } finally {
      setSweepingAll(false);
    }
  };

  const statusLabel =
    receivingStatus === 'ready'
      ? 'Registered for receiving'
      : receivingStatus === 'needs-setup'
        ? 'Local keys only — not published to ENS yet'
        : receivingStatus === 'keys-mismatch'
          ? 'Local keys do not match stealth-meta-address[1]'
          : receivingStatus === 'checking'
            ? 'Checking registration…'
            : 'Not ready';

  const spendable = rows.reduce((sum, row) => sum + row.balanceWei, BigInt(0));

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose={!scanning && !sweepingAll} mobileBottomSheet>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        }}
      />

      <IconButton
        label="Close"
        onClick={onClose}
        style={{ position: 'absolute', top: 8, right: 8 }}
      >
        <IconClose size={18} />
      </IconButton>

      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Collect payments</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          Scan with your viewing key, then sweep each stealth balance to a fresh address. Sweeping to this connected wallet links the payments to you.
        </p>
      </div>

      <div style={{ padding: '16px 24px 24px' }}>
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Connected wallet</p>
          <p className="mono" style={{ fontSize: 12, margin: 0, wordBreak: 'break-all' }}>
            {walletAddress || '—'}
          </p>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-body)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Meta-address</p>
            <IconButton
              label={copied ? 'Copied' : 'Copy meta-address'}
              onClick={handleCopy}
              disabled={!metaAddress}
              size={28}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </IconButton>
          </div>
          <p
            className="mono"
            style={{
              fontSize: 12,
              margin: 0,
              wordBreak: 'break-all',
              lineHeight: 1.45,
              color: metaAddress ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {metaAddress || 'Go Live to create payment keys for this wallet.'}
          </p>
        </div>

        <p
          style={{
            fontSize: 12,
            color:
              receivingStatus === 'ready'
                ? 'var(--success)'
                : receivingStatus === 'keys-mismatch' || receivingStatus === 'needs-setup'
                  ? 'var(--warn)'
                  : 'var(--text-muted)',
            margin: '0 0 16px',
          }}
        >
          {statusLabel}
        </p>

        <label
          htmlFor="sweep-destination"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}
        >
          Fresh destination
        </label>
        <input
          id="sweep-destination"
          type="text"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="0x… unused address"
          disabled={scanning || sweepingAll}
          autoComplete="off"
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
            marginBottom: 8,
          }}
        />
        {sameWallet(parsedDestination) ? (
          <p style={{ fontSize: 12, color: 'var(--live)', margin: '0 0 12px' }}>
            That is the connected wallet. Use a new address.
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.4 }}>
            Each sweep is a separate send. Do not reuse betman.eth / addr().
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button variant="secondary" fullWidth onClick={() => void handleScan()} disabled={scanning || !identity}>
            {scanning ? 'Scanning…' : 'Scan payments'}
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => void handleSweepAll()}
            disabled={!destinationOk || sweepingAll || rows.every((row) => row.balanceWei === BigInt(0))}
          >
            {sweepingAll ? 'Sweeping…' : `Sweep all${spendable > BigInt(0) ? ` (${formatEther(spendable)} ETH)` : ''}`}
          </Button>
        </div>

        {collectError ? (
          <p style={{ fontSize: 12, color: 'var(--live)', margin: '0 0 12px', lineHeight: 1.4 }}>{collectError}</p>
        ) : null}

        {rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
            {rows.map((row, index) => {
              const kind = parseStealthPaymentKind(row.payment.announcement.metadata, row.payment.sharedSecret);
              const announced = parseNativeEthAmount(row.payment.announcement.metadata);
              return (
                <div
                  key={row.payment.announcement.txHash}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>
                    {kind === 'tip' ? 'Tip' : 'Join'} · {formatEther(row.balanceWei)} ETH
                  </p>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, wordBreak: 'break-all' }}>
                    {row.payment.stealthAddress}
                  </p>
                  {announced !== null && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Announced {formatEther(announced)} ETH
                    </p>
                  )}
                  {row.detail && (
                    <p
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: row.status === 'error' ? 'var(--live)' : 'var(--success)',
                        margin: '4px 0 0',
                        wordBreak: 'break-all',
                      }}
                    >
                      {row.status === 'done' ? `Swept ${row.detail}` : row.detail}
                    </p>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!destinationOk || row.balanceWei === BigInt(0) || row.status === 'sweeping' || sweepingAll}
                      onClick={() => void handleSweepOne(index)}
                    >
                      {row.status === 'sweeping' ? 'Sweeping…' : row.balanceWei === BigInt(0) ? 'Empty' : 'Sweep this'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button variant="secondary" fullWidth onClick={onClose}>
          Close
        </Button>
      </div>
    </ModalShell>
  );
}
