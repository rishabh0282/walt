/**
 * Test script for billing functionality
 * 
 * Usage:
 *   node test-billing.js --userId <user_id>
 *   node test-billing.js --userId <user_id> --simulate-date 2024-01-15
 */

import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import * as billingUtils from './billingUtils.js';
import * as paymentService from './paymentService.js';
import { randomUUID as uuidv4 } from 'crypto';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const userIdIndex = args.indexOf('--userId');
const dateIndex = args.indexOf('--simulate-date');

if (userIdIndex === -1 || !args[userIdIndex + 1]) {
  console.error('Usage: node test-billing.js --userId <user_id> [--simulate-date YYYY-MM-DD]');
  process.exit(1);
}

const userId = args[userIdIndex + 1];
const simulateDate = dateIndex !== -1 ? args[dateIndex + 1] : null;

// Initialize database
const dbPath = process.env.DATABASE_URL?.replace('sqlite://', '') || './data/ipfs-drive.db';
const db = new Database(dbPath);

// Helper function to convert row to object
function rowToObject(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row));
}

async function testBilling() {
  try {
    console.log('🧪 Starting billing test...\n');

    // Get user
    const user = rowToObject(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (${user.id})`);

    // Get user's pinned files total size
    const pinnedFiles = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_pinned_size
      FROM files
      WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
    `).get(user.id);
    
    const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
    const pinnedSizeGB = pinnedSizeBytes / (1024 * 1024 * 1024);
    const monthlyCostUSD = billingUtils.calculateMonthlyPinCost(pinnedSizeBytes);
    const exceedsLimit = billingUtils.exceedsFreeTierLimit(pinnedSizeBytes);
    const chargeAmountINR = billingUtils.calculateChargeAmount(pinnedSizeBytes);

    console.log(`\n📊 Billing Information:`);
    console.log(`   Pinned Size: ${pinnedSizeGB.toFixed(2)} GB`);
    console.log(`   Monthly Cost: $${monthlyCostUSD.toFixed(2)}`);
    console.log(`   Free Tier Limit: $5.00`);
    console.log(`   Exceeds Limit: ${exceedsLimit ? '✅ Yes' : '❌ No'}`);
    console.log(`   Charge Amount: ₹${chargeAmountINR.toFixed(2)}`);

    if (chargeAmountINR <= 0) {
      console.log(`\n✅ User is within free tier limit. No charge needed.`);
      process.exit(0);
    }

    // Get or create subscription
    let subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
    if (!subscription) {
      console.log(`\n📅 Creating subscription...`);
      const billingDay = billingUtils.getBillingDay(user.created_at);
      const subId = uuidv4();
      const nextBilling = billingUtils.getNextBillingDate(billingDay);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, billing_day, next_billing_at)
        VALUES (?, ?, ?, ?)
      `).run(subId, user.id, billingDay, nextBilling.toISOString());
      subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId));
      console.log(`   Billing Day: ${billingDay}`);
      console.log(`   Next Billing: ${nextBilling.toISOString()}`);
    } else {
      console.log(`\n📅 Subscription Information:`);
      console.log(`   Billing Day: ${subscription.billing_day}`);
      console.log(`   Next Billing: ${subscription.next_billing_at}`);
    }

    const billingPeriod = billingUtils.getBillingPeriod(subscription.billing_day);
    console.log(`\n📆 Billing Period:`);
    console.log(`   Start: ${billingPeriod.start}`);
    console.log(`   End: ${billingPeriod.end}`);

    // Create payment order
    console.log(`\n💳 Creating payment order...`);
    const customerDetails = {
      customer_id: user.id,
      customer_email: user.email,
      customer_phone: "9999999999",
      customer_name: user.display_name || user.email
    };
    
    const result = await paymentService.createOrder(
      user.id,
      chargeAmountINR,
      "INR",
      customerDetails,
      {
        returnUrl: `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/payment/callback?order_id={order_id}`,
        notifyUrl: `${process.env.BACKEND_URL || 'https://api-walt.aayushman.dev'}/api/payment/webhook`
      }
    );
    
    if (!result.success) {
      console.error(`\n❌ Failed to create payment order: ${result.error}`);
      process.exit(1);
    }
    
    // Save order to database
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (
        id, user_id, cashfree_order_id, order_amount, order_currency,
        order_status, payment_session_id, payment_link,
        billing_period_start, billing_period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      user.id,
      result.cashfreeOrderId,
      chargeAmountINR,
      "INR",
      "PENDING",
      result.paymentSessionId,
      result.paymentLink,
      billingPeriod.start,
      billingPeriod.end
    );

    console.log(`\n✅ Payment order created successfully!`);
    console.log(`\n📋 Order Details:`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Cashfree Order ID: ${result.cashfreeOrderId}`);
    console.log(`   Amount: ₹${chargeAmountINR.toFixed(2)}`);
    console.log(`   Payment Link: ${result.paymentLink}`);
    console.log(`\n🔗 Open the payment link to complete the payment.`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

testBilling();

