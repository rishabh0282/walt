import { Cashfree } from "cashfree-pg";

// Initialize Cashfree
Cashfree.XClientId = process.env.CASHFREE_X_CLIENT_ID || process.env.X_CLIENT_ID || "";
Cashfree.XClientSecret = process.env.CASHFREE_X_CLIENT_SECRET || process.env.X_CLIENT_SECRET || "";
Cashfree.XEnvironment = (process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" || process.env.X_ENVIRONMENT === "PRODUCTION")
  ? Cashfree.Environment.PRODUCTION 
  : Cashfree.Environment.SANDBOX;

// Get API version (use current date in YYYY-MM-DD format)
const getApiVersion = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Create a payment order
 */
export async function createOrder(userId, orderAmount, orderCurrency = "INR", customerDetails, metadata = {}) {
  try {
    const apiVersion = getApiVersion();
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request = {
      order_amount: orderAmount,
      order_currency: orderCurrency,
      order_id: orderId,
      customer_details: customerDetails,
      order_meta: {
        return_url: metadata.returnUrl || `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/payment/callback?order_id={order_id}`,
        notify_url: metadata.notifyUrl || `${process.env.BACKEND_URL || 'https://api-walt.aayushman.dev'}/api/payment/webhook`,
        ...metadata
      }
    };

    const response = await Cashfree.PGCreateOrder(apiVersion, request);
    
    return {
      success: true,
      orderId: orderId,
      cashfreeOrderId: response.data?.order_id,
      paymentSessionId: response.data?.payment_session_id,
      paymentLink: response.data?.payment_link,
      data: response.data
    };
  } catch (error) {
    console.error('Cashfree create order error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create order'
    };
  }
}

/**
 * Fetch order details
 */
export async function fetchOrder(orderId) {
  try {
    const apiVersion = getApiVersion();
    const response = await Cashfree.PGFetchOrder(apiVersion, orderId);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Cashfree fetch order error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch order'
    };
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(signature, rawBody, timestamp) {
  try {
    Cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    return { success: true };
  } catch (error) {
    console.error('Webhook verification error:', error);
    return {
      success: false,
      error: error.message || 'Webhook verification failed'
    };
  }
}

