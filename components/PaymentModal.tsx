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
    
    // Check if already loaded
    const existing = (window as any).Cashfree;
    if (existing) {
      console.log('[Cashfree] SDK already loaded');
      return existing;
    }
    
    const src = getCashfreeScriptUrl();
    console.log('[Cashfree] Loading SDK from:', src);
    
    return new Promise((resolve, reject) => {
      // Check if script is already in the DOM
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        // Wait a bit for it to load
        const checkLoaded = setInterval(() => {
          if ((window as any).Cashfree) {
            clearInterval(checkLoaded);
            console.log('[Cashfree] SDK loaded from existing script');
            resolve((window as any).Cashfree);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkLoaded);
          if ((window as any).Cashfree) {
            resolve((window as any).Cashfree);
          } else {
            reject(new Error('Cashfree SDK script exists but failed to load'));
          }
        }, 5000);
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        // Give the SDK a moment to attach to window
        setTimeout(() => {
          const cf = (window as any).Cashfree;
          if (cf) {
            console.log('[Cashfree] SDK loaded successfully');
            resolve(cf);
          } else {
            console.error('[Cashfree] SDK script loaded but Cashfree object not found');
            reject(new Error('Cashfree object not found after script load'));
          }
        }, 100);
      };
      script.onerror = () => {
        console.error('[Cashfree] Failed to load SDK script');
        reject(new Error('Failed to load Cashfree SDK'));
      };
      document.head.appendChild(script);
    });
  };

  const startCheckout = async (sessionId: string) => {
    try {
      console.log('[Cashfree] Starting checkout with session:', sessionId);
      const cashfreeLib = await loadCashfree();
      
      if (!cashfreeLib) {
        throw new Error('Cashfree SDK not available');
      }

      console.log('[Cashfree] SDK loaded, type:', typeof cashfreeLib);
      console.log('[Cashfree] SDK properties:', Object.keys(cashfreeLib));

      const mode = cashfreeEnv === 'PRODUCTION' ? 'production' : 'sandbox';
      console.log('[Cashfree] Using mode:', mode);
      
      let cfInstance: any = null;

      // Method 1: Try factory-style usage (Cashfree({ mode }))
      if (typeof cashfreeLib === 'function') {
        console.log('[Cashfree] Attempting factory-style initialization');
        try {
          cfInstance = cashfreeLib({ mode });
          console.log('[Cashfree] Factory-style succeeded');
        } catch (e) {
          console.log('[Cashfree] Factory-style failed, trying with new keyword');
          // Some builds need `new Cashfree({ mode })`
          try {
            cfInstance = new cashfreeLib({ mode });
            console.log('[Cashfree] New keyword succeeded');
          } catch (err) {
            console.log('[Cashfree] New keyword failed');
            cfInstance = null;
          }
        }
      }

      // Method 2: Fallback - use the global object directly
      if (!cfInstance && typeof cashfreeLib === 'object') {
        console.log('[Cashfree] Using global object directly');
        cfInstance = cashfreeLib;
      }

      // Find the drop/redirect function (Cashfree SDK v2 uses 'drop' not 'checkout')
      let dropFn: any = null;
      
      if (cfInstance) {
        dropFn = cfInstance.drop || cfInstance.checkout;
        console.log('[Cashfree] Drop function on instance:', typeof dropFn);
      }
      
      if (!dropFn && (typeof cashfreeLib.drop === 'function' || typeof cashfreeLib.checkout === 'function')) {
        dropFn = cashfreeLib.drop || cashfreeLib.checkout;
        cfInstance = cashfreeLib;
        console.log('[Cashfree] Using drop from global object');
      }

      if (typeof dropFn !== 'function') {
        console.error('[Cashfree] Drop/checkout function not found');
        console.error('[Cashfree] Available on instance:', cfInstance ? Object.keys(cfInstance) : 'no instance');
        throw new Error('Cashfree drop method not available');
      }

      console.log('[Cashfree] Calling drop with config:', {
        paymentSessionId: sessionId,
        redirectTarget: '_modal'
      });

      // Call drop method
      const result = await dropFn.call(cfInstance, {
        paymentSessionId: sessionId,
        redirectTarget: '_modal' // Use '_modal' for embedded checkout
      });
      
      console.log('[Cashfree] Drop result:', result);
    } catch (sdkErr: any) {
      console.error('Cashfree checkout error:', sdkErr);
      console.error('Error stack:', sdkErr.stack);
      setError(`Unable to start checkout: ${sdkErr.message || 'Please try again.'}`);
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

