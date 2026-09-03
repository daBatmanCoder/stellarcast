'use client';

import { useState } from 'react';
import type { StealthIdentity } from '@/lib/types/stealth';
import { scanAnnouncementsForRecipient } from '@/lib/recipient/scanner';
import { displayName, ensCache } from '@/lib/ens/resolver';

interface RecipientScanProps {
  identity: StealthIdentity;
  registryAddress: string;
  announcerAddress: string;
}

interface MatchedAnnouncement {
  txHash: string;
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: string;
  metadata?: string;
}

export function RecipientScan({ identity, registryAddress, announcerAddress }: RecipientScanProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, matched: 0 });
  const [matches, setMatches] = useState<MatchedAnnouncement[]>([]);
  const [error, setError] = useState<string>('');
  const [fromBlock, setFromBlock] = useState<string>('0');

  const handleScan = async () => {
    setIsScanning(true);
    setError('');
    setMatches([]);
    setProgress({ scanned: 0, matched: 0 });

    try {
      const results = await scanAnnouncementsForRecipient(
        identity,
        parseInt(fromBlock) || 0,
        (progressUpdate) => {
          setProgress({ 
            scanned: progressUpdate.scannedCount, 
            matched: progressUpdate.matchedCount 
          });
        }
      );

      setMatches(results.map(r => ({
        txHash: r.txHash,
        stealthAddress: r.stealthAddress,
        ephemeralPubKey: r.ephemeralPublicKey,
        viewTag: `0x${r.viewTag.toString(16).padStart(2, '0')}`,
        metadata: r.metadata
      })));

      setProgress({ scanned: results.length, matched: results.length });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scan failed';
      setError(errorMsg);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="container-custom py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 style={{ fontSize: '2rem', fontWeight: 600 }}>
            Scan Announcements
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Search for stealth payments sent to your meta-address on Sepolia
          </p>
        </div>

        {/* Scan controls */}
        <div className="card p-6 space-y-4">
          <div className="space-y-2">
            <label style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
              From Block
            </label>
            <input
              type="text"
              value={fromBlock}
              onChange={(e) => setFromBlock(e.target.value)}
              placeholder="0"
              disabled={isScanning}
              className="w-full px-4 py-3 rounded-lg mono text-sm"
              style={{
                backgroundColor: 'var(--elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Start block number (0 = genesis, leave empty for latest 10,000 blocks)
            </p>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="btn btn-primary w-full"
          >
            {isScanning ? (
              <span className="flex items-center justify-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    animation: 'spin 1s linear infinite'
                  }}
                ></div>
                Scanning...
              </span>
            ) : (
              'Start Scan'
            )}
          </button>
        </div>

        {/* Progress */}
        {isScanning && (
          <div className="card p-4">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
              <span className="mono" style={{ color: 'var(--text-primary)' }}>
                {progress.scanned} scanned · {progress.matched} matched
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
            <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
              {error}
            </p>
          </div>
        )}

        {/* Results */}
        {matches.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Matched Announcements
              </h3>
              <div className="card px-3 py-1" style={{ borderColor: 'var(--success)' }}>
                <span className="mono text-sm" style={{ color: 'var(--success)', fontWeight: 600 }}>
                  {matches.length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {matches.map((match, idx) => (
                <div key={idx} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600 }}>
                        STEALTH ADDRESS
                      </p>
                      <p className="mono text-sm" style={{ color: 'var(--accent)' }}>
                        {match.stealthAddress}
                      </p>
                    </div>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${match.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      View tx →
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '4px' }}>
                        View Tag
                      </p>
                      <p className="mono" style={{ color: 'var(--text-secondary)' }}>
                        {match.viewTag}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '4px' }}>
                        Ephemeral PubKey
                      </p>
                      <p className="mono truncate" style={{ color: 'var(--text-secondary)' }}>
                        {match.ephemeralPubKey.slice(0, 20)}...
                      </p>
                    </div>
                  </div>

                  {match.metadata && (
                    <div>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                        METADATA
                      </p>
                      <p className="mono text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                        {match.metadata}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state after scan */}
        {!isScanning && matches.length === 0 && !error && fromBlock !== '0' && (
          <div className="card p-12 text-center space-y-3">
            <div style={{ fontSize: '3rem' }}>🔍</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              No announcements matched your viewing key
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
