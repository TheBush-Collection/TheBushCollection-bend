/**
 * PesaPal Configuration
 * Handles API credentials and environment settings
 */

export const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
export const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
export const environment = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
export const callbackUrl = process.env.PESAPAL_CALLBACK_URL || 'http://localhost:5000/payments/callback';

// Validate configuration on import
if (!consumerKey || !consumerSecret) {
  console.warn('⚠️  PesaPal credentials not fully configured. Please set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in .env');
}

console.log(`[PesaPal] Initialized in ${environment} mode`);
console.log(`[PesaPal] Callback URL: ${callbackUrl}`);

export default {
  consumerKey,
  consumerSecret,
  environment,
  callbackUrl
};