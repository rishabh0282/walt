/**
 * API Route: Upload file to IPFS and store metadata in database
 * POST /api/ipfs/upload
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File as FormidableFile } from 'formidable';
import { readFile } from 'fs/promises';
import { verifyAuth } from '../../../lib/apiAuth';
import { uploadToIPFS } from '../../../lib/ipfsClient';
import { FileDB, UserDB, ActivityLogDB } from '../../../lib/database';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
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

    // Parse form data
    const form = new IncomingForm({
      maxFileSize: 1024 * 1024 * 1024, // 1GB max
      keepExtensions: true,
    });

    const { fields, files } = await new Promise<{
      fields: any;
      files: any;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const folderId = fields.folderId?.[0] || fields.folderId || null;
    const autoPinString = fields.autoPin?.[0] || fields.autoPin || 'false';
    const autoPin = autoPinString === 'true';

    // Check storage quota
    const storageStats = await UserDB.getStorageStats(user.id);
    if (storageStats.used + file.size > storageStats.limit) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        used: storageStats.used,
        limit: storageStats.limit,
      });
    }

    // Read file content
    const fileBuffer = await readFile(file.filepath);

    // Upload to IPFS
    let uploadProgress = 0;
    const { cid, size } = await uploadToIPFS(fileBuffer, {
      filename: file.originalFilename || 'file',
      onProgress: (bytes) => {
        uploadProgress = bytes;
      },
    });

    // Store metadata in database
    const fileRecord = await FileDB.create({
      userId: user.id,
      cid,
      filename: file.originalFilename || 'unnamed',
      size,
      mimeType: file.mimetype || 'application/octet-stream',
      parentFolderId: folderId,
      isPinned: autoPin,
      pinService: autoPin ? 'local' : undefined,
    });

    // Log activity
    await ActivityLogDB.create({
      userId: user.id,
      fileId: fileRecord.id,
      action: 'upload',
      ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        cid,
        filename: fileRecord.filename,
        size,
        isPinned: autoPin,
      },
    });

    return res.status(200).json({
      success: true,
      file: {
        id: fileRecord.id,
        cid,
        filename: fileRecord.filename,
        size,
        mimeType: fileRecord.mime_type,
        isPinned: fileRecord.is_pinned,
        createdAt: fileRecord.created_at,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


