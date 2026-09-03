'use client';

import { useState, useEffect } from 'react';
import type { ProtocolAdapter } from '@/lib/protocol/adapters';

interface BrowseProps {
  adapter: ProtocolAdapter | null;
  onSelectEvent: (eventId: string) => void;
}

interface Event {
  id: string;
  title: string;
  host: string;
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
        // For now, use demo data since we don't have a full event registry
        // In production, this would query the contract
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setEvents([
          {
            id: '1',
            title: 'Private Crypto Workshop',
            host: '0x1234...5678',
            price: '0.05 ETH',
            isLive: true
          },
          {
            id: '2', 
            title: 'DeFi Deep Dive',
            host: '0xabcd...ef01',
            price: '0.03 ETH',
            isLive: false
          }
        ]);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [adapter]);

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
        <div className="max-w-md mx-auto space-y-4">
          <div style={{ fontSize: '3rem' }}>📹</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            No events yet
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Check back soon for live events
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
                  {event.host}
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
