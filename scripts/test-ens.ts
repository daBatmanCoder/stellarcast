/**
 * Test ENS resolution for betman.eth and 0xd0a2B03fccAd184B9EEC286feFa34301E9436206
 */

import { 
  resolveSepoliaENS, 
  resolveMainnetENS, 
  reverseResolveSepoliaENS, 
  reverseResolveMainnetENS,
  resolveENSWithNetwork,
  forwardResolveENSWithNetwork
} from '../lib/ens/resolver';

const TEST_ADDRESS = '0xd0a2B03fccAd184B9EEC286feFa34301E9436206';
const TEST_ENS = 'betman.eth';

async function testENSResolution() {
  console.log('=== ENS Resolution Test ===\n');
  
  console.log(`Testing address: ${TEST_ADDRESS}`);
  console.log(`Testing ENS name: ${TEST_ENS}\n`);

  // Test forward resolution on Sepolia
  console.log('1. Forward resolve betman.eth on Sepolia:');
  const sepoliaForward = await resolveSepoliaENS(TEST_ENS);
  console.log(`   Result: ${sepoliaForward || 'null'}\n`);

  // Test forward resolution on mainnet
  console.log('2. Forward resolve betman.eth on mainnet:');
  const mainnetForward = await resolveMainnetENS(TEST_ENS);
  console.log(`   Result: ${mainnetForward || 'null'}`);
  if (mainnetForward) {
    const matches = mainnetForward.toLowerCase() === TEST_ADDRESS.toLowerCase();
    console.log(`   Matches test address: ${matches}\n`);
  } else {
    console.log('');
  }

  // Test reverse resolution on Sepolia
  console.log('3. Reverse resolve address on Sepolia:');
  const sepoliaReverse = await reverseResolveSepoliaENS(TEST_ADDRESS);
  console.log(`   Result: ${sepoliaReverse || 'null'}\n`);

  // Test reverse resolution on mainnet
  console.log('4. Reverse resolve address on mainnet:');
  const mainnetReverse = await reverseResolveMainnetENS(TEST_ADDRESS);
  console.log(`   Result: ${mainnetReverse || 'null'}\n`);

  // Test combined resolution
  console.log('5. Combined reverse resolve (checks both networks):');
  const combined = await resolveENSWithNetwork(TEST_ADDRESS);
  if (combined) {
    console.log(`   Name: ${combined.name}`);
    console.log(`   Network: ${combined.network}\n`);
  } else {
    console.log('   Result: null\n');
  }

  // Test forward combined
  console.log('6. Combined forward resolve (checks both networks):');
  const forwardCombined = await forwardResolveENSWithNetwork(TEST_ENS);
  if (forwardCombined) {
    console.log(`   Address: ${forwardCombined.address}`);
    console.log(`   Network: ${forwardCombined.network}`);
    const matches = forwardCombined.address.toLowerCase() === TEST_ADDRESS.toLowerCase();
    console.log(`   Matches test address: ${matches}\n`);
  } else {
    console.log('   Result: null\n');
  }

  console.log('=== Test Complete ===');
}

testENSResolution().catch(console.error);
