'use client';

import { useState, useEffect } from 'react';
import type { ProtocolAdapter } from '@/lib/protocol/adapters';
import { ensCache, displayName, type ENSResult } from '@/lib/ens/resolver';

interface BrowseProps {
  adapter: ProtocolAdapter | null;
  onSelectEvent: (eventId: string) => void;
}

interface Event {
  id: string;
  title: string;
  hostAddress: string;
  hostEns?: ENSResult | null;
  price: string;
  isLive: boolean;
  imageUrl?: string;
}

export function Browse({ adapter, onSelectEvent }: BrowseProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch events from adapter
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        // TODO: Query real events from on-chain registry or announcements
        // For now, empty state - no fake catalogs
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setEvents([]);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [adapter]);

  // Resolve ENS names for all hosts
  useEffect(() => {
    const resolveENS = async () => {
      for (const event of events) {
        if (!event.hostEns) {
          const ensResult = await ensCache.resolve(event.hostAddress);
          if (ensResult) {
            setEvents(prev => prev.map(e => 
              e.id === event.id ? { ...e, hostEns: ensResult } : e
            ));
          }
        }
      }
    };

    if (events.length > 0) {
      resolveENS();
    }
  }, [events]);

  if (isLoading) {
    return (
      <div className="container-custom py-12">
        <h2 className="mb-8" style={{ fontSize: '2rem', fontWeight: 600 }}>
          Browse Events
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card aspect-video skeleton"></div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="container-custom py-32 text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div style={{ fontSize: '4rem' }}>📹</div>
          <div className="space-y-2">
            <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              No live events
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Event discovery coming soon. Creators will register stealth meta-addresses and announce streams on-chain.
            </p>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            Events will be queryable from ERC-6538 registry and ERC-5564 announcements on Sepolia
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom py-12">
      <h2 className="mb-8" style={{ fontSize: '2rem', fontWeight: 600 }}>
        Browse Events
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <button
            key={event.id}
            onClick={() => onSelectEvent(event.id)}
            className="card card-hover text-left overflow-hidden group"
          >
            {/* 16:9 aspect ratio container */}
            <div 
              className="w-full aspect-video relative"
              style={{ backgroundColor: 'var(--elevated)' }}
            >
              {event.isLive && (
                <div className="absolute top-3 left-3 live-indicator">
                  <span className="live-dot"></span>
                  LIVE
                </div>
              )}
            </div>

            <div className="p-4 space-y-2">
              <h3 
                className="font-semibold text-base line-clamp-1"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.title}
              </h3>
              
              <div className="flex items-center justify-between text-sm">
                <span 
                  className="mono truncate"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {displayName(event.hostAddress, event.hostEns)}
                </span>
                <span 
                  className="mono font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  {event.price}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
