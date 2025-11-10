import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { readFile } from 'fs/promises';
import { getOptimizedGatewayUrl } from '../../../lib/gatewayOptimizer';

export const config = {
  api: {
    bodyParser: false,
  },
};

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

const buildGatewayUrl = (cid: string, ipfsUri: string) => {
  try {
    return getOptimizedGatewayUrl(ipfsUri);
  } catch {
    const base =
      process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
      process.env.IPFS_GATEWAY ||
      'https://api-walt.aayushman.dev/ipfs';
    return `${base.replace(/\/$/, '')}/${cid}`;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm({
      maxFileSize: 200 * 1024 * 1024, // 200 MB
      keepExtensions: true,
    });

    const { files } = await new Promise<{
      files: any;
    }>((resolve, reject) => {
      form.parse(req, (err, _fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to backend IPFS node instead of direct connection
    const formData = new FormData();
    const buffer = await readFile(file.filepath);
    const blob = new Blob([buffer]);
    formData.append('file', blob, file.originalFilename || 'file');

    const uploadResponse = await fetch(`${BACKEND_URL}/api/ipfs/upload`, {
      method: 'POST',
      body: formData,
      // Note: Guest uploads don't require auth, but backend may need to handle this
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await uploadResponse.json();
    const cid = result.cid || result.file?.cid;
    const size = result.size || result.file?.size || buffer.length;
    
    if (!cid) {
      throw new Error('No CID returned from backend');
    }

    const ipfsUri = `ipfs://${cid}`;
    const gatewayUrl = buildGatewayUrl(cid, ipfsUri);

    return res.status(200).json({
      cid,
      size,
      filename: file.originalFilename || 'file',
      ipfsUri,
      gatewayUrl,
    });
  } catch (error) {
    console.error('Guest upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload guest file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
