import { getAuth } from 'firebase/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

export interface BillingStatus {
  pinnedSizeBytes: number;
  monthlyCostUSD: number;
  exceedsLimit: boolean;
  chargeAmountINR: number;
  freeTierLimitUSD: number;
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
      throw new Error('Failed to get billing status');
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
      throw new Error('Failed to check access');
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

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create order' };
    }

    return {
      success: true,
      orderId: data.orderId,
      paymentLink: data.paymentLink
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create order' };
  }
}

