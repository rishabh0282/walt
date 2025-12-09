import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { readFile } from 'fs/promises';
import FormData from 'form-data';
import { getOptimizedGatewayUrl } from '../../../lib/gatewayOptimizer';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { URL } from 'url';

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
    // Use https module directly to properly handle form-data streams
    const formData = new FormData();
    const buffer = await readFile(file.filepath);
    
    // Append file buffer with proper options
    formData.append('file', buffer, {
      filename: file.originalFilename || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    });

    // Use https/http.request to properly handle form-data stream
    const backendUrl = new URL(`${BACKEND_URL}/api/ipfs/upload/guest`);
    const isHttps = backendUrl.protocol === 'https:';
    const requestModule = isHttps ? httpsRequest : httpRequest;
    const defaultPort = isHttps ? 443 : 80;
    
    const result = await new Promise<any>((resolve, reject) => {
      const req = requestModule(
        {
          hostname: backendUrl.hostname,
          port: backendUrl.port || defaultPort,
          path: backendUrl.pathname,
          method: 'POST',
          headers: formData.getHeaders(),
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else {
              let errorData;
              try {
                errorData = JSON.parse(data);
              } catch {
                errorData = { error: data || 'Upload failed' };
              }
              reject(new Error(errorData.error || errorData.message || 'Upload failed'));
            }
          });
        }
      );

      req.on('error', reject);
      formData.pipe(req);
    });
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
