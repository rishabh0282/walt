import React, { useEffect } from 'react';
import CheckRoundIcon from '@rsuite/icons/CheckRound';
import CloseIcon from '@rsuite/icons/Close';
import CloseOutlineIcon from '@rsuite/icons/CloseOutline';
import InfoRoundIcon from '@rsuite/icons/InfoRound';
import styles from '../styles/Toast.module.css';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
  title?: string;
  progress?: number; // 0-100
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'success', 
  onClose, 
  duration = 3000,
  title,
  progress
}) => {
  useEffect(() => {
    // Don't auto-close if there's a progress bar (upload in progress)
    if (progress !== undefined && progress < 100) {
      return;
    }
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, progress]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckRoundIcon />;
      case 'error': return <CloseOutlineIcon />;
      case 'info': return <InfoRoundIcon />;
      default: return <CheckRoundIcon />;
    }
  };

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.icon}>{getIcon()}</span>
      <div className={styles.content}>
        {title && <div className={styles.title}>{title}</div>}
        <span className={styles.message}>{message}</span>
        {progress !== undefined && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={styles.progressText}>{Math.round(progress)}%</span>
          </div>
        )}
      </div>
      <button className={styles.close} onClick={onClose} aria-label="Close notification">
        <CloseIcon />
      </button>
    </div>
  );
};

export default Toast;

