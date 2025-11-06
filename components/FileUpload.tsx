import React, { useState, useCallback } from 'react';
import { useStorageUpload } from '@thirdweb-dev/react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { useUserFileStorage } from '../hooks/useUserFileStorage';
import { getOptimizedGatewayUrl } from '../lib/gatewayOptimizer';
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
  const { mutateAsync: upload } = useStorageUpload();
  const router = useRouter();
  const { user } = useAuth();
  const { addFiles } = useUserFileStorage(user?.uid || null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      
      setIsUploading(true);
      try {
        const uris = await upload({ data: acceptedFiles });

        // Create uploaded file objects
        const newFiles: UploadedFile[] = acceptedFiles.map((file, index) => ({
          id: `file_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          ipfsUri: uris[index],
          gatewayUrl: getOptimizedGatewayUrl(uris[index]),
          timestamp: Date.now(),
          type: file.type || 'unknown',
          size: file.size
        }));

        // Add files to IPFS-based storage
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
    [upload, router, addFiles]
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
