/**
 * API Route: List files (Proxy to Backend)
 * GET /api/ipfs/list - Get user's files and folders from backend database
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
    const { folderId } = req.query;
    const queryString = folderId ? `?folderId=${folderId}` : '';

    // Forward to backend
    const response = await fetch(`${BACKEND_URL}/api/ipfs/list${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('List proxy error:', error);
    return res.status(500).json({
      error: 'Failed to list files',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
