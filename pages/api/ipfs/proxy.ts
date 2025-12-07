/**
 * API Route: Proxy IPFS Gateway Requests
 * GET /api/ipfs/proxy?cid=QmXXX - Proxy IPFS content to avoid CORS issues
 * 
 * This route proxies requests to IPFS gateways to avoid CORS errors when
 * fetching from public gateways that don't allow localhost origins.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Prioritize local gateway first, then public gateways
const LOCAL_IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || process.env.IPFS_GATEWAY || 'http://localhost:8080/ipfs/';
const BACKEND_GATEWAY = process.env.NEXT_PUBLIC_BACKEND_API_URL 
  ? `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/ipfs/`
  : 'http://localhost:3001/ipfs/';

const IPFS_GATEWAYS = [
  // Local gateways first (no CORS issues when proxied)
  ...(LOCAL_IPFS_GATEWAY.includes('localhost') || LOCAL_IPFS_GATEWAY.includes('127.0.0.1') ? [LOCAL_IPFS_GATEWAY] : []),
  // Backend gateway only in production (nginx handles it, not available in local dev)
  ...(BACKEND_GATEWAY && !BACKEND_GATEWAY.includes('localhost') ? [BACKEND_GATEWAY] : []),
  // Public gateways as fallback (exclude problematic ones)
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cid } = req.query;
    
    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid cid parameter' });
    }

    // Try each gateway until one works
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const gatewayUrl = `${gateway}${cid}`;
        const response = await fetch(gatewayUrl, {
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });

        if (response.ok) {
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          
          // Copy content type from gateway
          const contentType = response.headers.get('content-type');
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }
          
          // Stream the response
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      } catch (error) {
        // Try next gateway
        continue;
      }
    }

    // All gateways failed
    return res.status(502).json({ 
      error: 'Failed to fetch from IPFS',
      message: 'All gateways failed to respond' 
    });
  } catch (error) {
    console.error('IPFS proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

