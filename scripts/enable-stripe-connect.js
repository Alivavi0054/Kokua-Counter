#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const stripeKeyMatch = envContent.match(/STRIPE_SECRET_KEY=(.+)/);
const stripeKey = stripeKeyMatch ? stripeKeyMatch[1].trim() : null;

if (!stripeKey) {
  console.error("❌ STRIPE_SECRET_KEY not found in .env.local");
  process.exit(1);
}

console.log("⚠️  To enable Stripe Connect and set up payouts, follow these steps:");
console.log("");
console.log("1. Test Mode (for local development):");
console.log("   - Go to: https://dashboard.stripe.com/account");
console.log("   - Make sure you're in TEST MODE (toggle in top-left)");
console.log("   - Look for 'Connect' in the left sidebar");
console.log("   - Click 'Activate Connect' or 'Complete your Connect account setup'");
console.log("   - Fill in the required details (you can use test data)");
console.log("");
console.log("2. Live Mode (for production at https://www.kokuacounter.app):");
console.log("   - Switch to LIVE MODE in Stripe Dashboard");
console.log("   - Complete the Connect onboarding (requires real business info)");
console.log("");
console.log("3. After enabling, the 'Set up payouts' button in the app will work.");
console.log("");
console.log("Your Stripe Account ID: acct_1UNcUOAklROVz8YS");
console.log("");
