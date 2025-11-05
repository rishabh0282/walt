/**
 * API Route: Get IPFS node status and health
 * GET /api/ipfs/status
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuth } from '../../../lib/apiAuth';
import { 
  checkNodeHealth, 
  getNodeInfo, 
  getRepoStats, 
  getPeerCount 
} from '../../../lib/ipfsClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (optional - you might want to make this public)
    const authUser = await verifyAuth(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get node health
    const health = await checkNodeHealth();

    if (!health.healthy) {
      return res.status(503).json({
        error: 'IPFS node unhealthy',
        details: health,
      });
    }

    // Get detailed stats
    const [nodeInfo, repoStats, peerCount] = await Promise.all([
      getNodeInfo().catch(() => null),
      getRepoStats().catch(() => null),
      getPeerCount().catch(() => 0),
    ]);

    return res.status(200).json({
      success: true,
      healthy: true,
      node: nodeInfo ? {
        id: nodeInfo.id,
        agentVersion: nodeInfo.agentVersion,
        addresses: nodeInfo.addresses.length,
      } : null,
      stats: repoStats ? {
        numObjects: repoStats.numObjects,
        repoSize: repoStats.repoSize,
        storageMax: repoStats.storageMax,
        usagePercent: ((repoStats.repoSize / repoStats.storageMax) * 100).toFixed(2),
      } : null,
      peers: peerCount,
    });
  } catch (error) {
    console.error('IPFS status error:', error);
    return res.status(500).json({
      error: 'Failed to get IPFS status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


