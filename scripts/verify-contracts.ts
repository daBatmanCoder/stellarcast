/**
 * Verify ERC-6538 registry and ERC-5564 announcer deployments
 * Checks canonical addresses against public RPCs using eth_getCode
 */

// Canonical addresses from ERC specs
const CANONICAL_REGISTRY = '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538';
const CANONICAL_ANNOUNCER = '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

// Public RPC endpoints (using reliable providers)
const RPC_ENDPOINTS: Record<string, string> = {
  'Ethereum Mainnet (1)': 'https://cloudflare-eth.com',
  'Sepolia (11155111)': 'https://ethereum-sepolia-rpc.publicnode.com',
  'Holesky (17000)': 'https://holesky.drpc.org',
};

interface ContractCheck {
  chain: string;
  chainId: number;
  registry: {
    address: string;
    deployed: boolean;
    bytecodeLength: number;
  };
  announcer: {
    address: string;
    deployed: boolean;
    bytecodeLength: number;
  };
}

async function getCode(rpcUrl: string, address: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [address, 'latest'],
      id: 1,
    }),
  });

  const data = await response.json();
  return data.result || '0x';
}

async function verifyContracts(): Promise<ContractCheck[]> {
  const results: ContractCheck[] = [];

  for (const [chainName, rpcUrl] of Object.entries(RPC_ENDPOINTS)) {
    console.log(`\nChecking ${chainName}...`);
    
    const chainId = parseInt(chainName.match(/\((\d+)\)/)?.[1] || '0');
    
    try {
      const registryCode = await getCode(rpcUrl, CANONICAL_REGISTRY);
      const announcerCode = await getCode(rpcUrl, CANONICAL_ANNOUNCER);

      const registryDeployed = registryCode.length > 2; // More than '0x'
      const announcerDeployed = announcerCode.length > 2;

      console.log(`  Registry ${CANONICAL_REGISTRY}: ${registryDeployed ? '✓' : '✗'} (${registryCode.length} chars)`);
      console.log(`  Announcer ${CANONICAL_ANNOUNCER}: ${announcerDeployed ? '✓' : '✗'} (${announcerCode.length} chars)`);

      results.push({
        chain: chainName,
        chainId,
        registry: {
          address: CANONICAL_REGISTRY,
          deployed: registryDeployed,
          bytecodeLength: registryCode.length,
        },
        announcer: {
          address: CANONICAL_ANNOUNCER,
          deployed: announcerDeployed,
          bytecodeLength: announcerCode.length,
        },
      });
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      results.push({
        chain: chainName,
        chainId,
        registry: {
          address: CANONICAL_REGISTRY,
          deployed: false,
          bytecodeLength: 0,
        },
        announcer: {
          address: CANONICAL_ANNOUNCER,
          deployed: false,
          bytecodeLength: 0,
        },
      });
    }
  }

  return results;
}

async function main() {
  console.log('Verifying ERC-6538/ERC-5564 contract deployments...');
  console.log(`Registry:  ${CANONICAL_REGISTRY}`);
  console.log(`Announcer: ${CANONICAL_ANNOUNCER}`);

  const results = await verifyContracts();

  console.log('\n=== SUMMARY ===\n');

  const verified = results.filter(r => r.registry.deployed && r.announcer.deployed);
  
  if (verified.length > 0) {
    console.log('✓ Verified deployments (both contracts):');
    verified.forEach(v => {
      console.log(`  Chain ID ${v.chainId} (${v.chain.split('(')[0].trim()})`);
    });
  } else {
    console.log('✗ No chains found with both contracts deployed');
  }

  console.log('\nKNOWN_CONTRACTS config:');
  console.log('{\n  // Verified deployments');
  verified.forEach(v => {
    console.log(`  ${v.chainId}: {`);
    console.log(`    registry: '${CANONICAL_REGISTRY}',`);
    console.log(`    announcer: '${CANONICAL_ANNOUNCER}',`);
    console.log(`  },`);
  });
  console.log('}');
}

main().catch(console.error);
