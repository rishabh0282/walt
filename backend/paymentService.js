// Import Cashfree SDK (version >=5 uses new API)
import { Cashfree, CFEnvironment } from "cashfree-pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Ensure .env in backend/ is loaded before we read credentials (server imports this
// module before calling dotenv.config in server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

// Validate imports
if (!Cashfree) {
  throw new Error("Failed to import Cashfree from cashfree-pg. Please ensure the package is installed: npm install cashfree-pg");
}

if (!CFEnvironment) {
  throw new Error("CFEnvironment is undefined. The cashfree-pg package may not be properly installed or is an incompatible version. Please check: npm list cashfree-pg");
}

// Get credentials from environment
const xClientId = process.env.CASHFREE_X_CLIENT_ID || process.env.X_CLIENT_ID || "";
const xClientSecret = process.env.CASHFREE_X_CLIENT_SECRET || process.env.X_CLIENT_SECRET || "";
const environment = (process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" || process.env.X_ENVIRONMENT === "PRODUCTION")
  ? CFEnvironment.PRODUCTION 
  : CFEnvironment.SANDBOX;

// Log credential presence (values masked) to help debug startup
const masked = (v) => (v ? `${v.slice(0, 4)}***${v.slice(-4)}` : "");
console.log("[Cashfree] Environment:", environment === CFEnvironment.PRODUCTION ? "PRODUCTION" : "SANDBOX");
console.log("[Cashfree] X_CLIENT_ID:", masked(xClientId));
console.log("[Cashfree] X_CLIENT_SECRET:", masked(xClientSecret));

// Initialize Cashfree instance
// Version >=5 requires creating an instance with environment and credentials
const cashfree = new Cashfree(environment, xClientId, xClientSecret);

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

    const response = await cashfree.PGCreateOrder(apiVersion, request);
    
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
    const response = await cashfree.PGFetchOrder(apiVersion, orderId);
    
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
    cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    return { success: true };
  } catch (error) {
    console.error('Webhook verification error:', error);
    return {
      success: false,
      error: error.message || 'Webhook verification failed'
    };
  }
}

