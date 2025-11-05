/**
 * API Route: List user's files from database
 * GET /api/ipfs/list?folderId=xxx
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuth } from '../../../lib/apiAuth';
import { FileDB, FolderDB, UserDB } from '../../../lib/database';
import { getGatewayUrl } from '../../../lib/ipfsClient';

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

    // Get user from database
    const user = await UserDB.getByFirebaseUid(authUser.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { folderId, view } = req.query;
    const folderIdString = Array.isArray(folderId) ? folderId[0] : folderId;
    const viewString = Array.isArray(view) ? view[0] : view;

    let files = [];
    let folders = [];

    // Handle different views
    if (viewString === 'starred') {
      files = await FileDB.getStarred(user.id);
    } else if (viewString === 'recent') {
      files = await FileDB.getRecent(user.id, 20);
    } else if (viewString === 'trash') {
      files = await FileDB.getTrash(user.id);
    } else {
      // Normal folder view
      files = await FileDB.listByFolder(user.id, folderIdString || null);
      folders = await FolderDB.listByParent(user.id, folderIdString || null);
    }

    // Format response with gateway URLs
    const formattedFiles = files.map((file) => ({
      id: file.id,
      cid: file.cid,
      filename: file.filename,
      size: file.size,
      mimeType: file.mime_type,
      isPinned: file.is_pinned,
      pinStatus: file.pin_status,
      isStarred: file.is_starred,
      isDeleted: file.is_deleted,
      parentFolderId: file.parent_folder_id,
      gatewayUrl: getGatewayUrl(file.cid, file.filename),
      ipfsUri: `ipfs://${file.cid}`,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      lastAccessedAt: file.last_accessed_at,
    }));

    const formattedFolders = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      isStarred: folder.is_starred,
      parentFolderId: folder.parent_folder_id,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    }));

    return res.status(200).json({
      success: true,
      files: formattedFiles,
      folders: formattedFolders,
    });
  } catch (error) {
    console.error('List files error:', error);
    return res.status(500).json({
      error: 'Failed to list files',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


