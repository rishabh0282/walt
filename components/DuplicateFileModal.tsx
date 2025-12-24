import React, { useState, useEffect } from 'react';
import styles from '../styles/DuplicateFileModal.module.css';

interface DuplicateFileModalProps {
  isOpen: boolean;
  fileName: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
  hasMultipleDuplicates?: boolean;
  onYesToAll?: (action: 'replace' | 'keepBoth') => void;
  onNoToAll?: () => void;
  remainingCount?: number;
}

const DuplicateFileModal: React.FC<DuplicateFileModalProps> = ({
  isOpen,
  fileName,
  onReplace,
  onKeepBoth,
  onCancel,
  hasMultipleDuplicates = false,
  onYesToAll,
  onNoToAll,
  remainingCount = 0
}) => {
  const [selectedOption, setSelectedOption] = useState<'replace' | 'keepBoth'>('replace');

  useEffect(() => {
    if (isOpen) {
      setSelectedOption('replace'); // Reset to default when modal opens
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpload = () => {
    if (selectedOption === 'replace') {
      onReplace();
    } else {
      onKeepBoth();
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Upload options</h2>
        </div>
        
        <div className={styles.content}>
          <p className={styles.message}>
            <strong>{fileName}</strong> already exists in this location. Do you want to replace the existing file with a new version or keep both files? Replacing the file won't change sharing settings.
            {hasMultipleDuplicates && remainingCount > 0 && (
              <span className={styles.remainingCount}> ({remainingCount} more file{remainingCount !== 1 ? 's' : ''} with the same name)</span>
            )}
          </p>
          
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="uploadOption"
                value="replace"
                checked={selectedOption === 'replace'}
                onChange={() => setSelectedOption('replace')}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>Replace existing file</span>
            </label>
            
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="uploadOption"
                value="keepBoth"
                checked={selectedOption === 'keepBoth'}
                onChange={() => setSelectedOption('keepBoth')}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>Keep both files</span>
            </label>
          </div>
        </div>
        
        <div className={styles.actions}>
          {hasMultipleDuplicates && (
            <>
              <button 
                className={styles.batchButton}
                onClick={onNoToAll}
              >
                No to All
              </button>
              <button 
                className={styles.batchButton}
                onClick={() => {
                  // Apply the selected option to current file first
                  if (selectedOption === 'replace') {
                    onReplace();
                  } else {
                    onKeepBoth();
                  }
                  // Then trigger Yes to All with the selected action
                  if (onYesToAll) {
                    onYesToAll(selectedOption);
                  }
                }}
              >
                Yes to All ({selectedOption === 'replace' ? 'Replace' : 'Keep'})
              </button>
              <button 
                className={styles.compareButton}
                onClick={handleUpload}
              >
                Compare Next
              </button>
            </>
          )}
          {!hasMultipleDuplicates && (
            <>
              <button 
                className={styles.cancelButton}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button 
                className={styles.uploadButton}
                onClick={handleUpload}
              >
                Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DuplicateFileModal;

