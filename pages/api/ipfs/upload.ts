/**
 * API Route: Upload file to IPFS (Proxy to Backend)
 * POST /api/ipfs/upload - Forwards file to backend API
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { readFile } from 'fs/promises';
import FormData from 'form-data';
import { verifyAuth } from '../../../lib/apiAuth';

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

// Disable body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
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

    // Get auth token to forward to backend
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

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

    // Forward to backend
    const formData = new FormData();
    const fileBuffer = await readFile(file.filepath);
    formData.append('file', fileBuffer, {
      filename: file.originalFilename || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    });

    // Add optional fields
    if (fields.folderId) {
      const folderId = Array.isArray(fields.folderId) ? fields.folderId[0] : fields.folderId;
      formData.append('parentFolderId', folderId);
    }
    if (fields.isPinned) {
      const isPinned = Array.isArray(fields.isPinned) ? fields.isPinned[0] : fields.isPinned;
      formData.append('isPinned', isPinned);
    }

    const response = await fetch(`${BACKEND_URL}/api/ipfs/upload`, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`,
      },
      body: formData as any,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
