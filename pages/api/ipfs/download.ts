/**
 * API Route: Download file from IPFS
 * GET /api/ipfs/download?fileId=xxx
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuthToken } from '../../../lib/apiAuth';
import { FileDB, UserDB, ActivityLogDB } from '../../../lib/database';
import { getFromIPFS } from '../../../lib/ipfsClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authUser = await verifyAuthToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database
    const user = await UserDB.getByFirebaseUid(authUser.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { fileId, cid } = req.query;
    const fileIdString = Array.isArray(fileId) ? fileId[0] : fileId;
    const cidString = Array.isArray(cid) ? cid[0] : cid;

    // Get file record
    let file;
    if (fileIdString) {
      file = await FileDB.getById(fileIdString, user.id);
    } else if (cidString) {
      file = await FileDB.getByCid(cidString, user.id);
    }

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update last accessed time
    await FileDB.updateLastAccessed(file.id);

    // Get file from IPFS
    const fileData = await getFromIPFS(file.cid);

    // Log download activity
    await ActivityLogDB.create({
      userId: user.id,
      fileId: file.id,
      action: 'download',
      ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        cid: file.cid,
        filename: file.filename,
        size: file.size,
      },
    });

    // Set response headers
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', fileData.length);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    // Send file
    return res.status(200).send(Buffer.from(fileData));
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      error: 'Download failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


