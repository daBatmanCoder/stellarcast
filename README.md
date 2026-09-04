# STELLARCAST - Private Livestream Events

A futuristic pay-to-view livestream platform where viewers pay for exclusive content using privacy-preserving stealth addresses. Watch premium livestreams without revealing your identity on-chain.

**[Live Demo on GitHub Pages](https://dabatmancoder.github.io/stellarcast/)** _(deployed automatically)_


## Concept

**The Problem:** Traditional livestream platforms require public wallet addresses for payment, exposing viewer identities and creating permanent on-chain spending records.

**The Solution:** STELLARCAST uses ERC-5564 stealth addresses to enable private payments. Viewers pay to one-time addresses that only the creator can decrypt, preserving anonymity while ensuring proof of payment. After access is granted, streaming happens peer-to-peer via encrypted WebRTC with zero additional blockchain activity.

## Experience Flow

1. **Discover Event**: Browse featured private livestream events from creators
2. **Connect Wallet**: Generate encrypted stealth identity (stored locally, never exposed)
3. **Pay Privately**: Payment sent to creator's stealth address - unlinkable to your identity
4. **Receive Credential**: Get encrypted access token via secure channel
5. **Watch Anonymously**: Stream via P2P WebRTC with no on-chain activity during viewing

## Technical Architecture

### Privacy-Preserving Payment

- **ERC-6538 Meta-Addresses**: Creators register public keys (P_spend || P_view) on-chain
- **ERC-5564 Stealth Addresses**: Each payment generates fresh one-time address
- **ECDH Shared Secrets**: Viewer and creator derive shared secret without key exchange
- **View Tags**: 1-byte filter enables fast payment scanning by creators
- **Forward Unlinkability**: Each payment uses unique ephemeral keys - no correlation possible

### Encrypted Access Credentials

- **HKDF-SHA256**: Domain-separated key derivation from shared secrets
- **AES-256-GCM**: Symmetric encryption for access tokens with unique nonces
- **Secure Delivery**: Credentials transmitted via encrypted announcements
- **No Public SDP**: WebRTC signaling data never exposed in plaintext

### Private Streaming

- **WebRTC DataChannel**: Direct peer-to-peer encrypted connection
- **Complete ICE Gathering**: Non-trickle MVP (full offers/answers before signaling)
- **Zero Chain Activity**: After credential verification, everything is P2P
- **Local Storage**: Identity keys encrypted with PBKDF2 (600k iterations) + AES-GCM in IndexedDB

## Deployment

### GitHub Pages (Static Site)

This app is configured as a **static Next.js export** and deploys automatically to GitHub Pages.

#### Automatic Deployment

1. Push to `main` branch
2. GitHub Actions builds static site
3. Deploys to `https://<username>.github.io/<repo-name>/`

The workflow is configured in `.github/workflows/deploy.yml`

#### Manual Deployment Setup

If deploying to your own fork:

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"

2. **Push to main branch**:
   ```bash
   git push origin main
   ```

3. **Deployment runs automatically** via GitHub Actions

4. **Access your site** at:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

#### Local Static Build

Test the static export locally:

```bash
# Build static site
npm run build

# The output is in ./out directory
# Serve it locally with any static server
npx serve out

# Or use Python
python3 -m http.server 8000 --directory out
```

### Static Hosting Limitations

**✅ What Works:**
- All client-side crypto (identity generation, stealth addresses, encryption)
- Mock protocol adapters for demo flow
- IndexedDB storage for encrypted identities
- WebRTC connection simulation
- Full UI and visual design

**❌ What Requires Server (Future):**
- Real-time blockchain event listening
- Server-side rendering (SSR) for performance
- API routes for backend services
- Relayer services for anonymous transaction submission
- Real WebRTC signaling coordination

**Current Mode:** Demo mode with simulated blockchain interactions. All crypto primitives are functional. Perfect for hackathon demonstration and privacy architecture showcase.

## Visual Design

**Cinematic Dark Space Theme**
- Deep space gradient background with animated nebula effects
- Glass morphism panels with blur and subtle borders
- Electric cyan/violet/gold accent palette for calls-to-action and highlights

**Glowing UI Elements**
- Text shadows on headings for cyberpunk glow effect
- Animated status rails with pulsing border effects
- Livestream indicators with pulse animations
- Flowing gradient borders on event cards

**Premium UX**
- Clear visual hierarchy with generous spacing
- Status timeline showing payment and access flow
- Live event hero with prominent streaming indicator
- Access credential display with monospace font

## Technology Stack

- **Frontend**: Next.js 16 (static export), React 19, TypeScript, Tailwind CSS
- **Crypto**: @noble/curves (secp256k1), @noble/hashes (SHA256, HKDF)
- **Storage**: IndexedDB (via `idb`) with PBKDF2 key wrapping
- **Web3**: viem, wagmi (interfaces prepared for live mode)
- **WebRTC**: Native browser RTCPeerConnection API
- **Deployment**: GitHub Pages with GitHub Actions

## Project Structure

```
lib/
  crypto/
    identity.ts          # Stealth identity generation
    stealth.ts          # ERC-5564 address derivation
    encryption.ts       # HKDF + AES-GCM for credentials
  storage/
    identity-store.ts   # Encrypted IndexedDB
  protocol/
    adapters.ts         # Mock/live blockchain adapters
  webrtc/
    signaling.ts        # Encrypted P2P connection setup
app/
  page.tsx              # Main livestream platform UI
  globals.css           # Futuristic visual design system
.github/
  workflows/
    deploy.yml          # GitHub Pages deployment
```

## Local Development

### Installation

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

Static files are exported to `./out` directory.

### Demo Features

- **Mock Payment Flow**: Simulated stealth address payment (no real ETH)
- **Simulated Livestream**: Visual representation of private streaming room
- **Functional Crypto**: All stealth address generation and encryption is real
- **Privacy Proofs**: Status timeline shows how blockchain activity ends after access grant

## Security Properties

### What This Prototype Provides

- **Payment Privacy**: Each payment uses fresh stealth address - observers cannot link payments to viewer
- **Forward Unlinkability**: Multiple purchases from same viewer appear as different identities
- **Encrypted Credentials**: Access tokens encrypted with ECDH-derived keys
- **No Key Reuse**: Wallet keys never used for streaming - independent stealth keys
- **Local Key Storage**: All private keys encrypted at rest with PBKDF2 + AES-GCM
- **View Tag Optimization**: Fast payment scanning without full ECDH per announcement

### Limitations (Prototype)

1. **Transaction Privacy**:
   - ⚠️ **Current**: Direct payment reveals caller address as potential viewer
   - ✅ **Phase 2**: Relayer network or meta-transaction service

2. **Network Privacy**:
   - ⚠️ **Current**: WebRTC may expose peer IP addresses
   - ✅ **Phase 2**: TURN relay-only configuration (changes trust model)

3. **Access Verification**:
   - ⚠️ **Current**: Mock credential verification
   - ✅ **Phase 2**: On-chain or off-chain proof verification

4. **Static Hosting**:
   - ⚠️ **Current**: GitHub Pages static export - no real-time blockchain sync
   - ✅ **Phase 2**: Server deployment for live blockchain integration

5. **Demo Mode**:
   - ⚠️ **Current**: Mock blockchain adapter - no real transactions
   - ✅ **Phase 2**: Live integration with testnet/mainnet

**This is a hackathon prototype showcasing privacy-preserving architecture. Not production software.**

## Use Cases

### For Creators

- **Private Audience**: Viewers pay without revealing identities
- **Stealth Payments**: Revenue arrives at unlinkable addresses
- **Exclusive Content**: Pay-per-view model with cryptographic access control
- **No Middleman**: Direct P2P streaming after access verification

### For Viewers

- **Anonymous Purchases**: Buy access without public spending records
- **Identity Protection**: Watch without exposing wallet address
- **Private Viewing**: No on-chain activity during stream
- **Censorship Resistant**: P2P connection bypasses centralized infrastructure

## Future Enhancements (Phase 2)

### Server Deployment Required

For live blockchain integration, deploy to:
- **Vercel**: Serverless functions for blockchain event listeners
- **AWS/GCP**: Full server for relayer network
- **IPFS + Backend**: Decentralized static hosting with API layer

### Live Integration

- Connect to testnet ERC-5564 Announcer contract
- Integrate ERC-6538 Registry for creator meta-addresses
- Real ETH/stablecoin payment flow
- Automated access credential verification
- Real-time blockchain event monitoring

### Advanced Features

- **Ticket NFTs**: Transferable access credentials as NFTs
- **Multi-Tier Access**: Different stealth addresses for VIP tiers
- **Scheduled Events**: Time-locked credential delivery
- **Creator Dashboard**: Track stealth payments and viewer analytics
- **Relayer Network**: Anonymous payment submission service
- **Replay Protection**: One-time credential with nullifier system

### Privacy Enhancements

- **Tor Integration**: Additional network-level privacy
- **TURN Relay**: Mandatory relay-only WebRTC for IP protection
- **Zero-Knowledge Proofs**: Prove payment without revealing amount
- **Mixing Service**: Payment batching for enhanced anonymity set

## Testing

```bash
# Run unit tests
npm test

# Type checking
npm run typecheck
```

### Test Coverage

- ✅ Stealth identity generation and uniqueness
- ✅ Meta-address encoding/decoding
- ✅ Stealth address derivation correctness
- ✅ ECDH shared secret equality (sender ↔ recipient)
- ✅ View tag filtering
- ✅ HKDF domain separation
- ✅ AES-GCM encryption with unique nonces
- ✅ Wrong key rejection
- ✅ End-to-end stealth payment flow

## Hackathon Highlights

**Innovation**: Privacy-preserving pay-per-view using stealth addresses - a novel application of ERC-5564/6538

**Technical Depth**: Full cryptographic implementation with proper primitives (no shortcuts)

**Visual Polish**: Futuristic UI with cinematic design and smooth animations

**Static Deployment**: GitHub Pages-ready with automated CI/CD

**Client-Side MVP**: All demo interactions work without server infrastructure

**Honest Limitations**: Clear labeling of demo mode and prototype constraints

**Extensibility**: Architecture ready for live integration with minimal changes

## Why Stealth Addresses for Livestreams?

Traditional payment models expose viewer preferences:
- Public wallet → all purchases visible
- Subscription services → identity tied to usage
- Platform custody → trust third parties

STELLARCAST demonstrates:
- **Pay-per-view** without identity exposure
- **Cryptographic access control** instead of account systems  
- **P2P streaming** after blockchain-mediated access grant
- **Creator sovereignty** with direct stealth payments

Perfect for private concerts, exclusive talks, sensitive content, and censorship-resistant broadcasting.

## License

MIT (Hackathon Prototype)

## Acknowledgments

- ERC-5564: Stealth Address Standard
- ERC-6538: Stealth Meta-Address Registry Standard
- @noble/curves and @noble/hashes by Paul Miller
- WebRTC specification by W3C
- GitHub Pages for static hosting

---

**Built for hackathon demonstration of privacy-preserving livestream access using stealth addresses.**

**Deployed as static site on GitHub Pages - all crypto primitives functional in demo mode.**
