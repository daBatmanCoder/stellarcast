# Stellarcast Room NFT Deployment Guide

## Overview

Stellarcast rooms are now implemented as **NFTs on Sepolia**. Each room NFT contains:
- **Public metadata**: Title, host ENS, category, tags, entry price, stealth meta-address
- **Encrypted access data**: Room credentials (WebRTC signaling, session tokens, etc.)

## Architecture

### Flow
1. **Host goes live**: 
   - Verifies ENS ownership
   - Sets up stealth meta-address for payments
   - Mints Room NFT with public metadata + encrypted access data
   
2. **Browse**: 
   - Reads public NFT metadata from chain (no payment required)
   - Displays room cards with title, host, category, etc.
   
3. **Viewer joins**:
   - Pays entry fee via stealth address
   - Derives decryption password from stealth shared secret
   - Decrypts room access data
   - Can now enter/interact with room

## Contract Deployment

### Option 1: Deploy via Remix (Recommended for quick testing)

1. Go to https://remix.ethereum.org
2. Create new file: `StellaCastRooms.sol`
3. Copy contract code from `/contracts/StellaCastRooms.sol`
4. Compile with Solidity 0.8.20+
5. Deploy:
   - Environment: "Injected Provider - MetaMask"
   - Connect MetaMask to Sepolia testnet
   - Click "Deploy"
6. Copy deployed contract address
7. Update `ROOM_CONTRACT_ADDRESS` in `/lib/blockchain/rooms-contract.ts`
8. Verify contract on Sepolia Etherscan (optional but recommended)

### Option 2: Deploy via Hardhat/Foundry

Coming soon - for production deployments with CI/CD

## Post-Deployment

1. Update the contract address in `/lib/blockchain/rooms-contract.ts`:
   ```typescript
   export const ROOM_CONTRACT_ADDRESS = '0xYOUR_DEPLOYED_ADDRESS_HERE';
   ```

2. Test the integration:
   ```bash
   # Start the dev server
   npm run dev
   
   # Go Live flow:
   # - Connect wallet
   # - Verify ENS
   # - Set up stealth
   # - Create room (will mint NFT)
   
   # Browse flow:
   # - Should show your created room
   # - Click to pay/join
   ```

3. Verify on Etherscan:
   - Go to https://sepolia.etherscan.io/address/YOUR_ADDRESS
   - Check "Contract" tab → "Read Contract"
   - Call `getAllRoomIds()` to see minted rooms
   - Call `getRoomMetadata(tokenId)` to read public data

## Current Status

**✅ CONTRACT DEPLOYED TO SEPOLIA**

- **Contract Address**: `0x4D34702b7967272adba2A361766cC461CF72f60a`
- **Deploy Transaction**: `0xee0266d005020adb19d4b54a88ece95a0f67439c6a0c6810bd70cfcfa342097f`
- **Deployer**: `0xD0a2b03fCCAD184B9eec286FeFA34301E9436206`
- **Etherscan**: https://sepolia.etherscan.io/address/0x4D34702b7967272adba2A361766cC461CF72f60a

The contract is live and ready to use. You can now:
1. Go Live to mint room NFTs
2. Browse will show created rooms
3. Test the full flow end-to-end

## Contract ABI

Key functions for integration:
- `createRoom(...)`: Mint new room NFT (called by host on Go Live)
- `getAllRoomIds()`: Get all room token IDs (called by Browse page)
- `getRoomMetadata(tokenId)`: Read public room data
- `getEncryptedAccessData(tokenId)`: Fetch encrypted credentials (viewer decrypts after payment)
- `updateRoomStatus(tokenId, isLive)`: Mark room live/offline

See `/lib/blockchain/rooms-contract.ts` for TypeScript wrappers.

## Production Considerations

For mainnet/production deployment:
1. Add access control (only host can update their rooms)
2. Consider IPFS for thumbnail/metadata storage (cheaper gas)
3. Implement room cleanup/deletion for offline rooms
4. Add ERC-721 standard compliance if transferability needed
5. Optimize gas costs (batching, calldata compression)
6. Add event indexing for faster room discovery
7. Consider Layer 2 deployment (Optimism, Arbitrum, Base) for lower costs

## Troubleshooting

**"Failed to create room" error**:
- Check that `ROOM_CONTRACT_ADDRESS` is set correctly
- Ensure wallet is connected to Sepolia
- Verify you have Sepolia ETH for gas

**Browse shows no rooms**:
- Check browser console for errors
- Verify contract address is correct
- Try calling `getAllRoomIds()` directly on Etherscan
- Ensure RPC provider is connected (MetaMask to Sepolia)

**Payment succeeds but can't decrypt**:
- Room NFT format may not match expected structure
- Check encrypted data was packaged correctly: `iv:encryptedHex`
- Verify shared secret derivation matches host's encryption key
