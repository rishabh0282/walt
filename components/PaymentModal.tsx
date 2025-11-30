import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import styles from '../styles/PaymentModal.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthlyCostUSD: number;
  chargeAmountINR: number;
  freeTierLimitUSD: number;
  billingPeriod?: {
    start: string;
    end: string;
  };
  nextBillingDate?: string;
  billingCycleDays?: number;
  onPaymentSuccess?: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  monthlyCostUSD,
  chargeAmountINR,
  freeTierLimitUSD,
  billingPeriod,
  nextBillingDate,
  billingCycleDays = 30,
  onPaymentSuccess
}) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const formatDate = (iso?: string) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatBillingPeriod = () => {
    if (!billingPeriod?.start || !billingPeriod?.end) return null;
    const start = formatDate(billingPeriod.start);
    const end = formatDate(billingPeriod.end);
    if (!start || !end) return null;
    return `${start} - ${end}`;
  };

  const billingCycleLabel = billingCycleDays === 30 ? 'Monthly' : `${billingCycleDays}-Day Cycle`;
  const billingPeriodLabel = formatBillingPeriod();
  const nextBillingLabel = formatDate(nextBillingDate);

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setError(null);
      setPaymentLink(null);
      setPaymentSessionId(null);
      setOrderId(null);
    }
  }, [isOpen]);

  const cashfreeEnv = (process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT || process.env.CASHFREE_ENVIRONMENT || '').toUpperCase() === 'PRODUCTION'
    ? 'PRODUCTION'
    : 'SANDBOX';

  const getCashfreeScriptUrl = () => {
    // Use Cashfree hosted checkout SDK (Drop) matching env
    return cashfreeEnv === 'PRODUCTION'
      ? 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.prod.js'
      : 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.sandbox.js';
  };

  const loadCashfree = async (): Promise<any | null> => {
    if (typeof window === 'undefined') return null;
    const existing = (window as any).Cashfree;
    if (existing) return existing;
    const src = getCashfreeScriptUrl();
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
      document.body.appendChild(script);
    });
    return (window as any).Cashfree || null;
  };

  const startCheckout = async (sessionId: string) => {
    try {
      const cashfree = await loadCashfree();
      if (!cashfree) {
        throw new Error('Cashfree SDK not available');
      }
      await cashfree.checkout({
        paymentSessionId: sessionId,
        redirectTarget: '_blank',
        env: cashfreeEnv === 'PRODUCTION' ? 'PROD' : 'SANDBOX'
      });
    } catch (sdkErr: any) {
      console.error('Cashfree checkout error:', sdkErr);
      setError('Unable to start checkout. Please try again.');
    }
  };

  const handleCreateOrder = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('Please log in to continue');
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev'}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment order');
      }

      if (data.orderId) setOrderId(data.orderId);
      if (data.paymentSessionId) setPaymentSessionId(data.paymentSessionId);
      if (data.paymentLink) setPaymentLink(data.paymentLink);

      // Prefer session-based checkout; if missing, surface error
      if (data.paymentSessionId) {
        startCheckout(data.paymentSessionId);
      } else {
        setError('Payment session not received');
      }

      if (data.orderId) {
        pollPaymentStatus(data.orderId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create payment order');
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (orderId: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (5 second intervals)
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev'}/api/payment/order/${orderId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) return;

        const order = await response.json();
        
        if (order.order_status === 'PAID') {
          // Payment successful
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
          onClose();
          return;
        }

        attempts++;
        if (attempts < maxAttempts && order.order_status === 'PENDING') {
          setTimeout(checkStatus, 5000); // Check again in 5 seconds
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
      }
    };

    setTimeout(checkStatus, 5000); // Start checking after 5 seconds
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Payment Required</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.warning}>
            <p>⚠️ Your estimated pin cost (${monthlyCostUSD.toFixed(2)}/month) exceeds the free tier limit of ${freeTierLimitUSD.toFixed(2)}/month.</p>
            <p>To continue using our services, please add payment information.</p>
          </div>

          <div className={styles.billingInfo}>
            <div className={styles.infoRow}>
              <span>Monthly Cost:</span>
              <span className={styles.amount}>${monthlyCostUSD.toFixed(2)}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Free Tier:</span>
              <span>${freeTierLimitUSD.toFixed(2)}/month</span>
            </div>
            <div className={styles.infoRow}>
              <span>Amount to Pay:</span>
              <span className={styles.chargeAmount}>₹{chargeAmountINR.toFixed(2)}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Billing Cycle:</span>
              <span>{billingCycleLabel}</span>
            </div>
            {billingPeriodLabel && (
              <div className={styles.infoRow}>
                <span>Current Period:</span>
                <span>{billingPeriodLabel}</span>
              </div>
            )}
            {nextBillingLabel && (
              <div className={styles.infoRow}>
                <span>Next Billing:</span>
                <span>{nextBillingLabel}</span>
              </div>
            )}
            <div className={styles.note}>
              <small>You will only be charged for the amount over ${freeTierLimitUSD.toFixed(2)}. Charges are calculated on a monthly cycle.</small>
            </div>
          </div>

          {!paymentLink ? (
            <div className={styles.form}>
              <label htmlFor="phone">Phone Number (required for payment)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                disabled={loading}
              />
              
              {error && <div className={styles.error}>{error}</div>}
              
              <button
                className={styles.payButton}
                onClick={handleCreateOrder}
                disabled={loading || !phone}
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          ) : (
            <div className={styles.paymentLink}>
              <p>Payment window opened. If it didn&apos;t open, click the link below:</p>
              <a href={paymentLink} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                Open Payment Page
              </a>
              <p className={styles.waiting}>Waiting for payment confirmation...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;

