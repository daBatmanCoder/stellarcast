/**
 * Test script to verify ENS stealth meta-address reading
 * Tests against betman.eth on Sepolia
 */

import { resolveSepoliaENS, getSepoliaTextRecord, getStealthMetaSlots } from '../lib/ens/resolver';
import { parseStealthMetaAddressFromENS } from '../lib/blockchain/contracts';

async function testBetmanENS() {
  console.log('\n=== Testing betman.eth on Sepolia ===\n');
  
  const ensName = 'betman.eth';
  
  // Test 1: Resolve ENS to address
  console.log('1. Resolving ENS name...');
  const resolvedAddress = await resolveSepoliaENS(ensName);
  console.log(`   ${ensName} → ${resolvedAddress || 'NOT FOUND'}`);
  
  if (!resolvedAddress) {
    console.log('   ❌ Cannot proceed without resolved address');
    return;
  }
  
  // Expected: 0xD0a2b03fCCAD184B9eec286FeFA34301E9436206
  const expectedAddress = '0xD0a2b03fCCAD184B9eec286FeFA34301E9436206';
  if (resolvedAddress.toLowerCase() === expectedAddress.toLowerCase()) {
    console.log('   ✅ Address matches expected value');
  } else {
    console.log(`   ⚠️  Address mismatch! Expected: ${expectedAddress}`);
  }
  
  // Test 2: Read stealth-meta-address[1]
  console.log('\n2. Reading stealth-meta-address[1]...');
  const textRecord = await getSepoliaTextRecord(ensName, 'stealth-meta-address[1]');
  console.log(`   Raw text record: ${textRecord || 'NOT FOUND'}`);
  
  if (!textRecord) {
    console.log('   ❌ No stealth-meta-address[1] found');
    return;
  }
  
  // Expected format: st:eth:0x...
  if (textRecord.startsWith('st:eth:0x')) {
    console.log('   ✅ Correct format (st:eth:0x...)');
  } else {
    console.log('   ❌ Incorrect format');
  }
  
  // Test 3: Parse the stealth meta-address
  console.log('\n3. Parsing stealth meta-address...');
  const parsed = parseStealthMetaAddressFromENS(textRecord);
  
  if (parsed) {
    console.log('   ✅ Successfully parsed!');
    console.log('   Spending pubkey:', Buffer.from(parsed.spendingPublicKey).toString('hex'));
    console.log('   Viewing pubkey:', Buffer.from(parsed.viewingPublicKey).toString('hex'));
    console.log('   Scheme:', parsed.scheme);
  } else {
    console.log('   ❌ Failed to parse');
    return;
  }
  
  // Test 4: Check for additional slots
  console.log('\n4. Checking for additional slots...');
  const slots = await getStealthMetaSlots(ensName);
  console.log(`   Found ${slots.length} slot(s):`);
  for (const slot of slots) {
    console.log(`   - Slot [${slot.slot}]: ${slot.value.slice(0, 30)}...`);
  }
  
  // Test 5: Check legacy key
  console.log('\n5. Checking legacy key (eth.stellarcast.stealth)...');
  const legacyRecord = await getSepoliaTextRecord(ensName, 'eth.stellarcast.stealth');
  if (legacyRecord) {
    console.log(`   Legacy record found: ${legacyRecord.slice(0, 30)}...`);
  } else {
    console.log('   No legacy record (expected for betman.eth)');
  }
  
  console.log('\n=== Test Complete ===\n');
}

// Run the test
testBetmanENS().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
