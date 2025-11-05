/**
 * API Route: Upload file to IPFS (Proxy to Backend)
 * POST /api/ipfs/upload - Forwards file to backend API
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { createReadStream } from 'fs';
import { FormData } from 'formdata-node';
import { verifyAuth } from '../../../lib/apiAuth';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001';

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
    formData.append('file', createReadStream(file.filepath), {
      filename: file.originalFilename || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    });

    // Add optional fields
    if (fields.folderId) {
      const folderId = Array.isArray(fields.folderId) ? fields.folderId[0] : fields.folderId;
      formData.append('folderId', folderId);
    }
    if (fields.autoPin) {
      const autoPin = Array.isArray(fields.autoPin) ? fields.autoPin[0] : fields.autoPin;
      formData.append('autoPin', autoPin);
    }

    const response = await fetch(`${BACKEND_URL}/api/ipfs/upload`, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
