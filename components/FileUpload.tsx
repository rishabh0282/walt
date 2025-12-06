/**
 * File Upload Component
 * 
 * Handles the upload flow: browser -> backend -> IPFS -> metadata storage. The backend
 * acts as a proxy to add authentication and handle IPFS node communication. This allows
 * browser uploads without exposing IPFS node credentials or dealing with CORS issues.
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useUserFileStorage } from '../hooks/useUserFileStorage';
import { getOptimizedGatewayUrl } from '../lib/gatewayOptimizer';
import { BackendFileAPI } from '../lib/backendClient';
import styles from './Home.module.css';

interface UploadedFile {
  id: string;
  name: string;
  ipfsUri: string;
  gatewayUrl: string;
  timestamp: number;
  type: string;
  size?: number;
}

const FileUpload: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { addFiles } = useUserFileStorage(user?.uid || null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      if (!user) {
        console.error('User not authenticated');
        return;
      }
      
      setIsUploading(true);
      try {
        // Firebase ID token authenticates the user to our backend
        const token = await user.getIdToken();

        // Backend handles IPFS upload and returns CID
        // This keeps IPFS node credentials secure and works around browser CORS
        const uploadPromises = acceptedFiles.map(file => 
          BackendFileAPI.upload(file, token)
        );
        const uploadResults = await Promise.all(uploadPromises);

        // Create uploaded file objects from backend response
        const newFiles: UploadedFile[] = uploadResults.map((result, index) => ({
          id: result.id,
          name: result.filename,
          ipfsUri: `ipfs://${result.cid}`,
          gatewayUrl: getOptimizedGatewayUrl(`ipfs://${result.cid}`), // Use fastest gateway
          timestamp: Date.now(),
          type: result.mimeType || 'unknown',
          size: result.size
        }));

        // Add to IPFS-backed file list (triggers save to IPFS + Firestore)
        await addFiles(newFiles);

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('Upload failed:', error);
        // Note: Error handling should be done by parent component
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [user, router, addFiles]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ 
    onDrop,
    multiple: true,
    noClick: true,
    noKeyboard: true 
  });

  const handleUploadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    open();
  };

  const handleDashboardClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    router.push('/dashboard');
  };

  return (
    <div {...getRootProps({ className: styles.uploadZone })}>
      <input {...getInputProps()} />
      <div className={styles.uploadActions}>
        <button
          className={`${styles.actionBtn} ${styles.primaryAction}`}
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading…' : isDragActive ? 'Release to Upload' : 'Upload Files'}
        </button>
        <button
          className={`${styles.actionBtn} ${styles.secondaryAction}`}
          onClick={handleDashboardClick}
        >
          Open Dashboard
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
