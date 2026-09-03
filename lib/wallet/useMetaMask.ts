/**
 * React hook for MetaMask integration
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isMetaMaskInstalled,
  connectMetaMask,
  getAccounts,
  getChainId,
  onAccountsChanged,
  onChainChanged,
  getNetworkName,
  type MetaMaskState,
} from './metamask';

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    isInstalled: false,
    isConnected: false,
    accounts: [],
    chainId: null,
    error: null,
  });

  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialize = async () => {
      const installed = isMetaMaskInstalled();
      
      if (!installed) {
        setState(prev => ({
          ...prev,
          isInstalled: false,
          error: 'MetaMask not installed',
        }));
        return;
      }

      const accounts = await getAccounts();
      const chainId = await getChainId();

      setState({
        isInstalled: true,
        isConnected: accounts.length > 0,
        accounts,
        chainId,
        error: null,
      });
    };

    initialize();
  }, []);

  // Subscribe to account and chain changes
  useEffect(() => {
    if (!state.isInstalled) return;

    const unsubscribeAccounts = onAccountsChanged((accounts) => {
      setState(prev => ({
        ...prev,
        accounts,
        isConnected: accounts.length > 0,
        error: accounts.length === 0 ? 'Disconnected from MetaMask' : null,
      }));
    });

    const unsubscribeChain = onChainChanged((chainId) => {
      setState(prev => ({
        ...prev,
        chainId,
      }));
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeChain();
    };
  }, [state.isInstalled]);

  const connect = useCallback(async () => {
    if (!state.isInstalled) {
      setState(prev => ({
        ...prev,
        error: 'MetaMask is not installed. Please install the MetaMask browser extension.',
      }));
      return false;
    }

    if (isConnecting) return false;

    setIsConnecting(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      const accounts = await connectMetaMask();
      const chainId = await getChainId();

      setState({
        isInstalled: true,
        isConnected: true,
        accounts,
        chainId,
        error: null,
      });

      setIsConnecting(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to MetaMask';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));

      setIsConnecting(false);
      return false;
    }
  }, [state.isInstalled, isConnecting]);

  const disconnect = useCallback(() => {
    // MetaMask doesn't have a programmatic disconnect
    // User must disconnect through MetaMask UI
    setState(prev => ({
      ...prev,
      error: 'Please disconnect through MetaMask extension',
    }));
  }, []);

  return {
    ...state,
    isConnecting,
    connect,
    disconnect,
    networkName: state.chainId ? getNetworkName(state.chainId) : null,
    address: state.accounts[0] || null,
  };
}
