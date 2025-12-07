import { getAuth } from 'firebase/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

// Log backend URL in development for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Billing Client] Using backend URL:', BACKEND_URL);
}

export interface BillingStatus {
  pinnedSizeBytes: number;
  pinnedSizeGB: number;
  freeTierGB: number;
  costPerGB: number;
  monthlyCostUSD: number;
  exceedsLimit: boolean;
  chargeAmountINR: number;
  freeTierLimitUSD: number; // Legacy support
  servicesBlocked: boolean;
  paymentInfoReceived: boolean;
  billingDay: number;
  nextBillingDate: string;
  billingPeriod: {
    start: string;
    end: string;
  };
}

export interface AccessCheck {
  allowed: boolean;
  reason: string | null;
  monthlyCostUSD?: number;
  chargeAmountINR?: number;
  freeTierLimitUSD?: number;
  paymentInfoReceived?: boolean;
  billingDay?: number;
  nextBillingDate?: string;
}

/**
 * Get billing status for current user
 */
export async function getBillingStatus(): Promise<BillingStatus | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/billing/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get billing status' }));
      const errorMessage = errorData.error || errorData.message || 'Failed to get billing status';
      
      // Provide more helpful error messages
      if (response.status === 0 || response.status === 500) {
        console.error(`Cannot connect to backend at ${BACKEND_URL}/api/billing/status`);
      }
      if (response.status === 401) {
        console.error('Authentication failed for billing status check');
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting billing status:', error);
    return null;
  }
}

/**
 * Check if user has access to services
 */
export async function checkAccess(): Promise<AccessCheck | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/billing/check-access`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to check access' }));
      const errorMessage = errorData.error || errorData.message || 'Failed to check access';
      
      // Provide more helpful error messages
      if (response.status === 0 || response.status === 500) {
        console.error(`Cannot connect to backend at ${BACKEND_URL}/api/billing/check-access`);
      }
      if (response.status === 401) {
        console.error('Authentication failed for access check');
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking access:', error);
    return null;
  }
}

/**
 * Create payment order
 */
export async function createPaymentOrder(phone: string): Promise<{
  success: boolean;
  orderId?: string;
  paymentLink?: string;
  error?: string;
}> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ phone })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create order' }));
      return { success: false, error: errorData.error || errorData.message || 'Failed to create order' };
    }

    const data = await response.json();

    return {
      success: true,
      orderId: data.orderId,
      paymentLink: data.paymentLink
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create order' };
  }
}

