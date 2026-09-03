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

/**
 * Call contract read method (eth_call)
 */
export async function callContract(
  contractAddress: string,
  data: string,
  from?: string
): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  try {
    const result = await window.ethereum.request({
      method: 'eth_call',
      params: [
        {
          to: contractAddress,
          data,
          from,
        },
        'latest',
      ],
    }) as string;

    return result;
  } catch (error: unknown) {
    const callError = error as { message: string };
    throw new Error(`Contract call failed: ${callError.message}`);
  }
}

/**
 * Get contract bytecode
 */
export async function getContractCode(address: string): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  try {
    const code = await window.ethereum.request({
      method: 'eth_getCode',
      params: [address, 'latest'],
    }) as string;

    return code;
  } catch (error: unknown) {
    const codeError = error as { message: string };
    throw new Error(`Failed to get contract code: ${codeError.message}`);
  }
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
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available');
  }

  try {
    const logs = await window.ethereum.request({
      method: 'eth_getLogs',
      params: [
        {
          address,
          fromBlock,
          toBlock,
          topics,
        },
      ],
    }) as unknown[];

    return logs;
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
