/**
 * Share Utilities
 * Helper functions for generating reliable share links using backend gateway
 */

/**
 * Get backend gateway URL for a file
 * This uses your own backend gateway instead of unreliable public IPFS gateways
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

