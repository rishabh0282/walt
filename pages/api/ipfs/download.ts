/**
 * API Route: Download file (Proxy to Backend)
 * GET /api/ipfs/download - Download file from IPFS via backend
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuth } from '../../../lib/apiAuth';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authUser = await verifyAuth(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get auth token to forward to backend
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    // Get query params
    const { cid, fileId } = req.query;
    
    if (!cid && !fileId) {
      return res.status(400).json({ error: 'Missing cid or fileId parameter' });
    }

    const queryString = cid ? `?cid=${cid}` : `?fileId=${fileId}`;

    // Forward to backend
    const response = await fetch(`${BACKEND_URL}/api/ipfs/download${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Download failed' }));
      return res.status(response.status).json(data);
    }

    // Stream the file back to client
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');
    
    res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download proxy error:', error);
    return res.status(500).json({
      error: 'Download failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
