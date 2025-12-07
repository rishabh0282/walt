import React from 'react';
import DangerIcon from '@rsuite/icons/Danger';
import InfoRoundIcon from '@rsuite/icons/InfoRound';
import WarningRoundIcon from '@rsuite/icons/WarningRound';
import styles from '../styles/ConfirmationModal.module.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'warning' | 'danger' | 'info';
  showSuppressOption?: boolean;
  onSuppressChange?: (suppress: boolean) => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
  showSuppressOption = false,
  onSuppressChange
}) => {
  const [suppressChecked, setSuppressChecked] = React.useState(false);
  
  // Reset checkbox when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSuppressChecked(false);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleSuppressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSuppressChecked(checked);
    if (onSuppressChange) {
      onSuppressChange(checked);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger': return <DangerIcon />;
      case 'info': return <InfoRoundIcon />;
      case 'warning': 
      default: return <WarningRoundIcon />;
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>{getIcon()}</div>
          <h2 className={styles.title}>{title}</h2>
        </div>
        
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
          {showSuppressOption && (
            <label className={styles.suppressOption}>
              <input
                type="checkbox"
                checked={suppressChecked}
                onChange={handleSuppressChange}
              />
              <span>Don't show this warning again</span>
            </label>
          )}
        </div>
        
        <div className={styles.actions}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.button} ${styles.confirmButton} ${styles[type]}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
