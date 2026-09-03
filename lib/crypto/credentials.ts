/**
 * Cryptographically secure credential generation
 * NEVER uses Math.random() - only crypto.getRandomValues()
 */

/**
 * Generate a cryptographically secure random credential
 * Uses crypto.getRandomValues() for true randomness
 */
export function generateSecureCredential(prefix: string = 'CRED'): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${hex}`;
}

/**
 * Generate a secure random ID
 */
export function generateSecureId(length: number = 16): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure base64-encoded token
 */
export function generateSecureToken(byteLength: number = 32): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(byteLength));
  
  // Convert to base64url (URL-safe base64)
  let base64 = btoa(String.fromCharCode(...randomBytes));
  base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return base64;
}

/**
 * Derive an access credential from a shared secret
 * Uses the shared secret directly, no need for additional randomness
 */
export function deriveAccessCredential(sharedSecret: Uint8Array): string {
  const hex = Array.from(sharedSecret)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const timestamp = Date.now();
  return `ACCESS_${timestamp}_${hex.slice(0, 32)}`;
}

/**
 * Verify an access credential format (basic validation)
 */
export function isValidCredentialFormat(credential: string): boolean {
  // Check if it matches our expected format
  const pattern = /^[A-Z_]+_\d+_[a-f0-9]+$/;
  return pattern.test(credential);
}
