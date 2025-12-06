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
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'success', 
  onClose, 
  duration = 3000 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

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
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={onClose} aria-label="Close notification">
        <CloseIcon />
      </button>
    </div>
  );
};

export default Toast;

