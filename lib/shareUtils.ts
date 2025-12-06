/**
 * Share Utilities
 * 
 * Public IPFS gateways are slow and unreliable for sharing. This module routes shares
 * through our backend gateway, which provides consistent performance and allows us to
 * track access metrics. Falls back gracefully to public gateways if backend is down.
 */

/**
 * Get backend gateway URL for a file
 * 
 * Using our own gateway ensures:
 * - Consistent availability (not subject to public gateway rate limits)
 * - Better performance (geographically close to users)
 * - Access control (for password-protected shares)
 */
export function getBackendGatewayUrl(ipfsUriOrCid: string): string {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';
  
  // Extract CID from ipfs:// URI or use as-is if already a CID
  const cid = ipfsUriOrCid.replace('ipfs://', '');
  
  return `${backendUrl}/ipfs/${cid}`;
}

/**
 * Get shareable file URL
 * Returns the most reliable URL for sharing files
 */
export function getShareableFileUrl(file: { ipfsUri?: string; cid?: string }): string {
  const identifier = file.ipfsUri || file.cid;
  if (!identifier) {
    throw new Error('File must have ipfsUri or cid');
  }
  
  return getBackendGatewayUrl(identifier);
}

