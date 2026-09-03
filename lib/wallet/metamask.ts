/**
 * Real MetaMask integration using window.ethereum
 * Never accesses or generates wallet private keys - MetaMask manages those
 */

export interface MetaMaskState {
  isInstalled: boolean;
  isConnected: boolean;
  accounts: string[];
  chainId: string | null;
  error: string | null;
}

// Window.ethereum is declared in blockchain/transactions.ts

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.ethereum && window.ethereum.isMetaMask);
}

/**
 * Request MetaMask account connection
 * User must approve in MetaMask popup
 */
export async function connectMetaMask(): Promise<string[]> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask extension.');
  }

  try {
    const accounts = await window.ethereum!.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from MetaMask');
    }

    return accounts;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('MetaMask connection rejected by user');
      }
      throw error;
    }
    throw new Error('Failed to connect to MetaMask');
  }
}

/**
 * Get currently connected accounts (doesn't trigger popup)
 */
export async function getAccounts(): Promise<string[]> {
  if (!isMetaMaskInstalled()) {
    return [];
  }

  try {
    const accounts = await window.ethereum!.request({
      method: 'eth_accounts',
    }) as string[];
    return accounts || [];
  } catch {
    return [];
  }
}

/**
 * Get current chain ID
 */
export async function getChainId(): Promise<string | null> {
  if (!isMetaMaskInstalled()) {
    return null;
  }

  try {
    const chainId = await window.ethereum!.request({
      method: 'eth_chainId',
    }) as string;
    return chainId;
  } catch {
    return null;
  }
}

/**
 * Subscribe to account changes
 */
export function onAccountsChanged(handler: (accounts: string[]) => void): () => void {
  if (!isMetaMaskInstalled()) {
    return () => {};
  }

  const listener = (accounts: unknown) => {
    handler(accounts as string[]);
  };

  window.ethereum!.on('accountsChanged', listener);

  return () => {
    window.ethereum!.removeListener('accountsChanged', listener);
  };
}

/**
 * Subscribe to chain changes
 */
export function onChainChanged(handler: (chainId: string) => void): () => void {
  if (!isMetaMaskInstalled()) {
    return () => {};
  }

  const listener = (chainId: unknown) => {
    handler(chainId as string);
  };

  window.ethereum!.on('chainChanged', listener);

  return () => {
    window.ethereum!.removeListener('chainChanged', listener);
  };
}

/**
 * Request network switch
 */
export async function switchChain(chainId: string): Promise<void> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error: unknown) {
    const switchError = error as { code: number; message: string };
    if (switchError.code === 4902) {
      // Chain not added, try to add it
      throw new Error(`Chain ${chainId} not added to MetaMask. Attempting to add...`);
    }
    throw error;
  }
}

/**
 * Add Sepolia network to MetaMask if missing
 */
export async function addSepoliaNetwork(): Promise<void> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  try {
    await window.ethereum!.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0xaa36a7',
        chainName: 'Sepolia Testnet',
        nativeCurrency: {
          name: 'Sepolia ETH',
          symbol: 'SepoliaETH',
          decimals: 18,
        },
        rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      }],
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to add Sepolia network: ${error.message}`);
    }
    throw new Error('Failed to add Sepolia network');
  }
}

/**
 * Ensure user is on Sepolia network
 * Attempts to switch, adds network if needed
 */
export async function ensureSepoliaNetwork(): Promise<void> {
  const currentChainId = await getChainId();
  
  if (currentChainId === '0xaa36a7') {
    // Already on Sepolia
    return;
  }

  try {
    await switchChain('0xaa36a7');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not added')) {
      // Try to add the network
      await addSepoliaNetwork();
    } else {
      throw error;
    }
  }
}

/**
 * Sign a message with MetaMask (for authentication/verification)
 */
export async function signMessage(
  account: string,
  message: string
): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const signature = await window.ethereum!.request({
      method: 'personal_sign',
      params: [message, account],
    }) as string;

    return signature;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User rejected')) {
      throw new Error('Signature rejected by user');
    }
    throw error;
  }
}

/**
 * Format chain ID to readable network name
 */
export function getNetworkName(chainId: string): string {
  const networks: Record<string, string> = {
    '0x1': 'Ethereum Mainnet',
    '0x5': 'Goerli Testnet',
    '0xaa36a7': 'Sepolia Testnet',
    '0x89': 'Polygon Mainnet',
    '0x13881': 'Mumbai Testnet',
    '0xa': 'Optimism Mainnet',
    '0xa4b1': 'Arbitrum One',
  };

  return networks[chainId] || `Unknown Network (${chainId})`;
}
