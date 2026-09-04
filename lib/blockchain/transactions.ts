/**
 * Real blockchain transactions using window.ethereum
 * eth_sendTransaction, eth_getTransactionReceipt, etc.
 */

export interface TransactionRequest {
  from: string;
  to: string;
  value: string; // hex wei
  data?: string;
  gas?: string;
  gasPrice?: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  from: string;
  to: string;
  status: string;
  gasUsed: string;
  logs?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

/**
 * Send ETH transaction via MetaMask
 * Returns transaction hash
 */
export async function sendEthTransaction(
  from: string,
  to: string,
  valueInEth: string
): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  // Convert ETH to wei (hex)
  const valueInWei = BigInt(Math.floor(parseFloat(valueInEth) * 1e18));
  const valueHex = '0x' + valueInWei.toString(16);

  const txParams: TransactionRequest = {
    from,
    to,
    value: valueHex,
  };

  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    }) as string;

    return txHash;
  } catch (error: unknown) {
    const txError = error as { code: number; message: string };
    if (txError.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Transaction failed: ${txError.message}`);
  }
}

/**
 * Wait for transaction receipt
 * Polls every 2 seconds, times out after 2 minutes
 */
export async function waitForTransactionReceipt(
  txHash: string,
  timeoutMs: number = 120000
): Promise<TransactionReceipt> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }) as TransactionReceipt | null;

      if (receipt) {
        // Check if transaction succeeded
        if (receipt.status === '0x0') {
          throw new Error('Transaction failed on-chain');
        }
        return receipt;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Transaction failed')) {
        throw error;
      }
      // Continue polling on other errors
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Transaction receipt timeout after 2 minutes');
}

/**
 * Send contract call transaction via MetaMask
 */
export async function sendContractTransaction(
  from: string,
  contractAddress: string,
  data: string,
  value: string = '0x0'
): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  const txParams: TransactionRequest = {
    from,
    to: contractAddress,
    value,
    data,
  };

  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    }) as string;

    return txHash;
  } catch (error: unknown) {
    const txError = error as { code: number; message: string };
    if (txError.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Contract call failed: ${txError.message}`);
  }
}

export const SEPOLIA_PUBLIC_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

async function publicRpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(SEPOLIA_PUBLIC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sepolia RPC ${response.status}`);
  }

  const json = (await response.json()) as {
    result?: unknown;
    error?: { message?: string };
  };

  if (json.error) {
    throw new Error(json.error.message || 'Sepolia RPC error');
  }

  return json.result;
}

/**
 * Call contract read method (eth_call)
 */
export async function callContract(
  contractAddress: string,
  data: string,
  from?: string
): Promise<string> {
  try {
    const result = await publicRpc('eth_call', [
      {
        to: contractAddress,
        data,
        from,
      },
      'latest',
    ]);
    return result as string;
  } catch (error: unknown) {
    const callError = error as { message: string };
    throw new Error(`Contract call failed: ${callError.message}`);
  }
}

/**
 * Get contract bytecode
 */
export async function getContractCode(address: string): Promise<string> {
  try {
    const code = await publicRpc('eth_getCode', [address, 'latest']);
    return code as string;
  } catch (error: unknown) {
    const codeError = error as { message: string };
    throw new Error(`Failed to get contract code: ${codeError.message}`);
  }
}

/**
 * Current chain head.
 */
export async function getBlockNumber(): Promise<number> {
  const hex = await publicRpc('eth_blockNumber', []) as string;
  return parseInt(hex, 16);
}

export function parseBlockNumber(block?: string | number | null): number | undefined {
  if (block === undefined || block === null || block === '') return undefined;
  if (typeof block === 'number' && Number.isFinite(block)) return block;
  const hex = String(block);
  const n = hex.startsWith('0x') || hex.startsWith('0X') ? parseInt(hex, 16) : parseInt(hex, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Verify contract is deployed at address
 */
export async function verifyContractDeployed(address: string): Promise<boolean> {
  const code = await getContractCode(address);
  // '0x' or '0x0' means no contract deployed
  return code.length > 2;
}

/**
 * Get logs (events) from contract
 */
export async function getLogs(
  address: string,
  fromBlock: string = '0x0',
  toBlock: string = 'latest',
  topics?: string[]
): Promise<unknown[]> {
  try {
    const logs = await publicRpc('eth_getLogs', [
      {
        address,
        fromBlock,
        toBlock,
        topics,
      },
    ]);
    return (logs as unknown[]) || [];
  } catch (error: unknown) {
    const logError = error as { message: string };
    throw new Error(`Failed to get logs: ${logError.message}`);
  }
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
