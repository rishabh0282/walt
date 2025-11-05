/**
 * IPFS Client for connecting to self-hosted IPFS node
 * Supports both HTTP API and Helia (browser-side)
 */

import { create as createIPFSClient, IPFSHTTPClient } from 'ipfs-http-client';

// Cache IPFS client instance
let ipfsClient: IPFSHTTPClient | null = null;

/**
 * Get or create IPFS HTTP client
 */
export function getIPFSClient(): IPFSHTTPClient {
  if (!ipfsClient) {
    const apiUrl = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
    
    try {
      ipfsClient = createIPFSClient({
        url: apiUrl,
        timeout: 60000, // 60 seconds
      });
      
      console.log('IPFS client initialized:', apiUrl);
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      throw new Error('IPFS client initialization failed');
    }
  }
  
  return ipfsClient;
}

/**
 * Upload file to IPFS
 */
export async function uploadToIPFS(
  file: Buffer | Uint8Array | Blob,
  options?: {
    filename?: string;
    onProgress?: (bytes: number) => void;
  }
): Promise<{ cid: string; size: number }> {
  const client = getIPFSClient();
  
  try {
    const result = await client.add(file, {
      pin: true,
      progress: options?.onProgress,
      wrapWithDirectory: false,
    });
    
    return {
      cid: result.cid.toString(),
      size: result.size,
    };
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw new Error('Failed to upload to IPFS');
  }
}

/**
 * Upload multiple files as a directory
 */
export async function uploadDirectoryToIPFS(
  files: Array<{ path: string; content: Buffer | Uint8Array }>
): Promise<{ cid: string; files: Array<{ path: string; cid: string; size: number }> }> {
  const client = getIPFSClient();
  
  try {
    const results: Array<{ path: string; cid: string; size: number }> = [];
    let directoryCid = '';
    
    for await (const result of client.addAll(files, { pin: true, wrapWithDirectory: true })) {
      if (result.path === '') {
        directoryCid = result.cid.toString();
      } else {
        results.push({
          path: result.path,
          cid: result.cid.toString(),
          size: result.size,
        });
      }
    }
    
    return {
      cid: directoryCid,
      files: results,
    };
  } catch (error) {
    console.error('IPFS directory upload error:', error);
    throw new Error('Failed to upload directory to IPFS');
  }
}

/**
 * Get file from IPFS
 */
export async function getFromIPFS(cid: string): Promise<Uint8Array> {
  const client = getIPFSClient();
  
  try {
    const chunks: Uint8Array[] = [];
    
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    
    // Concatenate all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  } catch (error) {
    console.error('IPFS get error:', error);
    throw new Error('Failed to retrieve from IPFS');
  }
}

/**
 * Pin content to IPFS
 */
export async function pinToIPFS(cid: string): Promise<void> {
  const client = getIPFSClient();
  
  try {
    await client.pin.add(cid);
    console.log(`Pinned CID: ${cid}`);
  } catch (error) {
    console.error('IPFS pin error:', error);
    throw new Error('Failed to pin to IPFS');
  }
}

/**
 * Unpin content from IPFS
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  const client = getIPFSClient();
  
  try {
    await client.pin.rm(cid);
    console.log(`Unpinned CID: ${cid}`);
  } catch (error) {
    console.error('IPFS unpin error:', error);
    throw new Error('Failed to unpin from IPFS');
  }
}

/**
 * List all pinned content
 */
export async function listPinnedContent(): Promise<string[]> {
  const client = getIPFSClient();
  
  try {
    const pins: string[] = [];
    
    for await (const { cid } of client.pin.ls({ type: 'recursive' })) {
      pins.push(cid.toString());
    }
    
    return pins;
  } catch (error) {
    console.error('IPFS pin list error:', error);
    throw new Error('Failed to list pinned content');
  }
}

/**
 * Check if content is pinned
 */
export async function isPinned(cid: string): Promise<boolean> {
  const client = getIPFSClient();
  
  try {
    for await (const { cid: pinnedCid } of client.pin.ls({ paths: cid })) {
      if (pinnedCid.toString() === cid) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get IPFS node info
 */
export async function getNodeInfo(): Promise<{
  id: string;
  agentVersion: string;
  protocolVersion: string;
  addresses: string[];
}> {
  const client = getIPFSClient();
  
  try {
    const info = await client.id();
    
    return {
      id: info.id.toString(),
      agentVersion: info.agentVersion || 'unknown',
      protocolVersion: info.protocolVersion || 'unknown',
      addresses: info.addresses.map(addr => addr.toString()),
    };
  } catch (error) {
    console.error('IPFS node info error:', error);
    throw new Error('Failed to get node info');
  }
}

/**
 * Get repository stats
 */
export async function getRepoStats(): Promise<{
  numObjects: number;
  repoSize: number;
  storageMax: number;
  repoPath: string;
}> {
  const client = getIPFSClient();
  
  try {
    const stats = await client.repo.stat();
    
    return {
      numObjects: Number(stats.numObjects),
      repoSize: Number(stats.repoSize),
      storageMax: Number(stats.storageMax),
      repoPath: stats.repoPath || 'unknown',
    };
  } catch (error) {
    console.error('IPFS repo stats error:', error);
    throw new Error('Failed to get repo stats');
  }
}

/**
 * Get number of connected peers
 */
export async function getPeerCount(): Promise<number> {
  const client = getIPFSClient();
  
  try {
    const peers = await client.swarm.peers();
    return peers.length;
  } catch (error) {
    console.error('IPFS peer count error:', error);
    return 0;
  }
}

/**
 * Generate IPFS gateway URL
 */
export function getGatewayUrl(cid: string, filename?: string): string {
  const gatewayUrl = process.env.IPFS_GATEWAY_URL || 'http://localhost:8080';
  const url = `${gatewayUrl}/ipfs/${cid}`;
  
  if (filename) {
    return `${url}?filename=${encodeURIComponent(filename)}`;
  }
  
  return url;
}

/**
 * Get public gateway URLs (fallback)
 */
export function getPublicGatewayUrls(cid: string): string[] {
  return [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
  ];
}

/**
 * Check node health
 */
export async function checkNodeHealth(): Promise<{
  healthy: boolean;
  peerCount: number;
  repoSize?: number;
  error?: string;
}> {
  try {
    const [peerCount, repoStats] = await Promise.all([
      getPeerCount(),
      getRepoStats().catch(() => null),
    ]);
    
    return {
      healthy: true,
      peerCount,
      repoSize: repoStats?.repoSize,
    };
  } catch (error) {
    return {
      healthy: false,
      peerCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default {
  getIPFSClient,
  uploadToIPFS,
  uploadDirectoryToIPFS,
  getFromIPFS,
  pinToIPFS,
  unpinFromIPFS,
  listPinnedContent,
  isPinned,
  getNodeInfo,
  getRepoStats,
  getPeerCount,
  getGatewayUrl,
  getPublicGatewayUrls,
  checkNodeHealth,
};


