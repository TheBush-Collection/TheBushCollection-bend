import { environment, consumerKey, consumerSecret, callbackUrl } from '../config/pesapal.js';
import axios from 'axios';
import { randomUUID } from 'crypto';
import Booking from '../models/booking.model.js';

class PesapalController {
    constructor() {
        // Use separate bases: auth endpoints vs transactions endpoints can differ between environments
        // expose environment for logging
        this.environment = environment;

        // authBase vs transactions base can differ between live and sandbox
        this.authBase = this.environment === 'live'
            ? 'https://pay.pesapal.com'
            : 'https://cybqa.pesapal.com/pesapalv3';

        this.txBase = this.environment === 'live'
            ? 'https://pay.pesapal.com/v3'
            : 'https://cybqa.pesapal.com/pesapalv3';

    }

    async getAuthToken() {
        try {
            // Try multiple auth URL variants because sandbox/live hosts may expose the
            // RequestToken endpoint under slightly different base paths (with or
            // without the /pesapalv3 segment). Build candidate URLs and try each
            // until one succeeds or all fail.
            const base = String(this.authBase || '').replace(/\/+$/g, '');
            const urlCandidates = [
                `${base}/api/Auth/RequestToken`,
                `${base}/pesapalv3/api/Auth/RequestToken`,
                `${base}/v3/api/Auth/RequestToken`,
                // legacy variant
                `${base}/api/v3/Auth/RequestToken`
            ];

            let response = null;
            let lastErr = null;

            for (const url of urlCandidates) {
                try {
                    console.log('[PesaPal] Trying auth URL:', url);
                    response = await axios.post(url, {
                        consumer_key: consumerKey,
                        consumer_secret: consumerSecret
                    }, { headers: { 'Content-Type': 'application/json' } });
                    // if we get here, we have a response (may be 2xx)
                    break;
                } catch (e) {
                    lastErr = e;
                    // If 404 or other error, log and continue to next candidate
                    console.warn('[PesaPal] Auth attempt failed for', url, e.response?.status || e.message);
                    // continue
                }
            }

            if (!response) {
                // nothing worked — surface last error
                throw lastErr || new Error('No auth response from any candidate URL');
            }
            // Log response preview for diagnostics
            try {
                const respPreview = typeof response.data === 'string' ? response.data.substring(0, 2000) : JSON.stringify(response.data).substring(0, 2000);
                console.log('[PesaPal] Auth response preview:', respPreview);
            } catch (e) {
                console.log('[PesaPal] Auth response received (unable to preview body)');
            }

            // Try common locations for token in provider responses
            const tokenCandidates = [];
            if (response.data) {
                tokenCandidates.push(response.data.token, response.data.access_token);
                // nested shapes
                if (response.data.data) {
                    tokenCandidates.push(response.data.data.token, response.data.data.access_token);
                }
                // sometimes an array is returned
                if (Array.isArray(response.data) && response.data.length > 0) {
                    tokenCandidates.push(response.data[0].token, response.data[0].access_token);
                }
            }

            // Fallbacks: some sandbox endpoints expect form-encoded POST or return a token inside a string/HTML.
            // If we didn't find a token from the JSON attempt, try form-encoded body and also regex-extraction on string responses.
            const foundInCandidates = tokenCandidates.find(t => typeof t === 'string' && t.length > 10);
            if (!foundInCandidates) {
                try {
                    const params = new URLSearchParams();
                    params.append('consumer_key', consumerKey);
                    params.append('consumer_secret', consumerSecret);
                    // Try form-encoded POST
                    const formResp = await axios.post(url, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                    response = formResp;
                    try {
                        const respPreview2 = typeof response.data === 'string' ? response.data.substring(0, 2000) : JSON.stringify(response.data).substring(0, 2000);
                        console.log('[PesaPal] Auth response preview (form fallback):', respPreview2);
                    } catch (e) {
                        console.log('[PesaPal] Auth response received (form fallback, unable to preview body)');
                    }

                    if (response.data) {
                        tokenCandidates.push(response.data.token, response.data.access_token);
                        if (response.data.data) {
                            tokenCandidates.push(response.data.data.token, response.data.data.access_token);
                        }
                        if (Array.isArray(response.data) && response.data.length > 0) {
                            tokenCandidates.push(response.data[0].token, response.data[0].access_token);
                        }
                    }

                    // If still not found and response is string-ish, attempt regex extraction of a token-like substring
                    if (!tokenCandidates.find(t => typeof t === 'string' && t.length > 10) && typeof response.data === 'string') {
                        const s = response.data;
                        const rx = /(?:token|access_token|accessToken|auth_token)[^A-Za-z0-9\-\._]*([A-Za-z0-9\-\._]{20,})/i;
                        const m = s.match(rx);
                        if (m && m[1]) tokenCandidates.push(m[1]);
                    }

                } catch (formErr) {
                    console.warn('[PesaPal] Form-encoded auth fallback failed:', formErr.message || formErr);
                }
            }

            const found = tokenCandidates.find(t => typeof t === 'string' && t.length > 10);
            if (!found) {
                throw new Error('No token in response');
            }

            console.log(`[PesaPal] Auth token obtained (${this.environment} mode)`);
            return found;
        } catch (error) {
            console.error('[PesaPal] Auth Error:', error.response?.data || error.message);
            if (error.response) {
                console.error('[PesaPal] Auth response status:', error.response.status);
                console.error('[PesaPal] Auth response headers:', error.response.headers);
            }
            // Do NOT return a mock token — surface the real auth error so we can fix credentials/URL
            console.error('[PesaPal] getAuthToken failed — not returning mock token.');
            if (error.response && error.response.data) {
                // Include response preview for debugging
                try {
                    const preview = typeof error.response.data === 'string' ? error.response.data.substring(0, 1000) : JSON.stringify(error.response.data).substring(0, 1000);
                    console.error('[PesaPal] Auth response preview:', preview);
                } catch (e) {
                    console.error('[PesaPal] Failed to preview auth response body');
                }
            }
            throw new Error('Failed to get PesaPal auth token: ' + (error.message || 'unknown'));
        }
    }

    async submitOrder(req, res) {
        try {
            const {
                amount,
                currency,
                description,
                email,
                firstName,
                lastName,
                phoneNumber,
                bookingId,
                bookingReference
            } = req.body;

            // Validate required fields
            if (!amount || !email || !bookingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: amount, email, bookingId'
                });
            }

            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be greater than 0'
                });
            }

            // Check if booking exists. Accept either Mongo _id or bookingId (merchant reference)
            let booking = null;
            if (bookingId) {
                // Try by ObjectId first
                try {
                    booking = await Booking.findById(bookingId);
                } catch (err) {
                    booking = null;
                }
            }
            // If not found by _id and a bookingId string was provided, try lookup by bookingId field
            if (!booking && bookingId) {
                booking = await Booking.findOne({ bookingId: bookingId });
            }

            if (!booking) {
                // If frontend provided a booking payload, create the booking on-the-fly
                const bookingPayload = req.body?.bookingPayload || null;
                if (bookingPayload && typeof bookingPayload === 'object') {
                    try {
                        console.log('[PesaPal] Creating booking on-the-fly for payment initiation');
                        const created = await Booking.create(bookingPayload);
                        booking = created;
                        // ensure bookingId variable points to mongo id for updates
                        // overwrite bookingId for later update operations
                        // eslint-disable-next-line no-param-reassign
                        req.body.bookingId = created._id.toString();
                    } catch (createErr) {
                        console.error('[PesaPal] Failed to create booking on-the-fly:', createErr.message || createErr);
                        return res.status(404).json({
                            success: false,
                            error: 'Booking not found and auto-creation failed'
                        });
                    }
                } else {
                    return res.status(404).json({
                        success: false,
                        error: 'Booking not found (provide Mongo _id or bookingId reference)'
                    });
                }
            }

            const token = await this.getAuthToken();
            // If we received a mock token (returned for local sandbox dev when auth fails),
            // fail early so we don't call SubmitOrder with an invalid token.
            if (typeof token === 'string' && token.startsWith('mock_token_dev_')) {
                console.error('[PesaPal] Aborting SubmitOrder: mock auth token in use (auth likely failed).');
                return res.status(502).json({
                    success: false,
                    error: 'PesaPal auth failed — mock token was returned',
                    details: 'getAuthToken returned a mock token for sandbox development. Check PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET and ensure the sandbox endpoint is reachable.'
                });
            }
            
            const orderId = randomUUID();
            // Ensure amount is formatted as two-decimal string (e.g. "261.00")
            const formattedAmount = (typeof amount === 'number' || !isNaN(Number(amount)))
                ? Number(amount).toFixed(2)
                : String(amount);

            // Sanitize phone number: allow digits and leading + only
            const sanitizedPhone = phoneNumber
                ? String(phoneNumber).trim().replace(/[^+\d]/g, '')
                : '';

            const orderData = {
                id: orderId,
                currency: (currency || 'KES').toUpperCase(),
                // PesaPal often expects a string with two decimal places
                amount: formattedAmount,
                description: description || `Booking Payment - ${bookingReference || bookingId}`,
                callback_url: callbackUrl,
                redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/confirmation`,
                // use order-specific notification id for uniqueness
                notification_id: process.env.PESAPAL_IPN_ID,
                billing_address: {
                    email_address: email,
                    phone_number: sanitizedPhone,
                    first_name: firstName || 'Guest',
                    last_name: lastName || 'Booking',
                    country_code: 'KE'
                }
            };

            console.log('[PesaPal] Submitting order:', orderId, 'Amount:', amount);
            console.log('[PesaPal] orderData:', JSON.stringify(orderData));
            console.log('[PesaPal] Using token:', token ? token.substring(0, 20) + '...' : 'no-token');

            let response;
            // Try multiple transaction URL variants to handle sandbox/live path differences
            const txBaseClean = String(this.txBase || '').replace(/\/+$/g, '');
            const txCandidates = [
                `${txBaseClean}/api/Transactions/SubmitOrder`,
                `${txBaseClean}/v3/api/Transactions/SubmitOrder`,
                `${txBaseClean}/pesapalv3/api/Transactions/SubmitOrder`,
                `${txBaseClean}/Api/Transactions/SubmitOrder`,
                `${txBaseClean}/transactions/SubmitOrder`
            ];

            let lastAxiosErr = null;
            for (const url of txCandidates) {
                try {
                    console.log('[PesaPal] Trying SubmitOrder URL:', url);
                    response = await axios.post(url, orderData, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    break;
                } catch (axiosErr) {
                    lastAxiosErr = axiosErr;
                    console.warn('[PesaPal] SubmitOrder attempt failed for', url, axiosErr.response?.status || axiosErr.message);
                    // If we get a 404 with the specific message, continue to try other candidates
                    // otherwise keep trying but record the last error
                }
            }

            if (!response) {
                const axiosErr = lastAxiosErr;
                console.error('[PesaPal] SubmitOrder request failed (all candidates):', axiosErr?.message || 'no response');
                if (axiosErr && axiosErr.response) {
                    console.error('[PesaPal] SubmitOrder response status:', axiosErr.response.status);
                    console.error('[PesaPal] SubmitOrder response headers:', axiosErr.response.headers);
                    try {
                        const bodyStr = typeof axiosErr.response.data === 'string'
                            ? axiosErr.response.data
                            : JSON.stringify(axiosErr.response.data);
                        console.error('[PesaPal] SubmitOrder response data (truncated 4000 chars):', bodyStr.substring(0, 4000));
                    } catch (e) {
                        console.error('[PesaPal] Failed to stringify response body');
                    }

                    return res.status(502).json({
                        success: false,
                        error: 'PesaPal SubmitOrder error',
                        details: axiosErr.response.data || axiosErr.message,
                        status: axiosErr.response.status,
                        headers: axiosErr.response.headers
                    });
                }

                return res.status(502).json({ success: false, error: axiosErr?.message || 'PesaPal request failed' });
            }

            // Normalize PesaPal response fields (providers use inconsistent names)
            const raw = response.data || {};
            const redirectUrl = raw.redirect_url || raw.redirectUrl || raw.checkout_url || raw.checkoutUrl || raw.redirect || raw.url || raw.payment_url || raw.paymentUrl || null;
            const orderTrackingIdResp = raw.order_tracking_id || raw.orderTrackingId || raw.order_tracking || raw.tracking_id || raw.orderId || raw.transaction_id || null;

            console.log('[PesaPal] Order submitted successfully. Raw response preview:', JSON.stringify(raw).substring(0, 2000));

            // Build embed iframe URL if a store page is configured (server-side embed page)
            const embedPage = process.env.PESAPAL_STORE_PAGE_URL || process.env.PESAPAL_EMBED_PAGE_URL || null;
            const embedIframeSrc = embedPage ? `https://store.pesapal.com/embed-code?pageUrl=${encodeURIComponent(embedPage)}` : (raw.embedIframeSrc || raw.embed_iframe || raw.iframe_url || raw.iframeUrl || null);

            // If we don't have a redirect URL or an embed iframe, return an explicit error
            if (!redirectUrl && !embedIframeSrc) {
                console.error('[PesaPal] No redirect or embed URL found in SubmitOrder response:', JSON.stringify(raw).substring(0, 2000));
                // persist minimal payment details for debugging
                const paymentDetailsUpdate = {
                    pesapalOrderId: orderId,
                    orderTrackingId: orderTrackingIdResp,
                    status: 'initiated',
                    initiatedAt: new Date(),
                    initiatedAmount: orderData.amount,
                    pesapalResponse: raw
                };
                try {
                    await Booking.findByIdAndUpdate(bookingId, { $set: { paymentDetails: paymentDetailsUpdate } });
                } catch (dbErr) {
                    console.warn('[PesaPal] Failed to persist debug payment details:', dbErr.message || dbErr);
                }

                return res.status(502).json({
                    success: false,
                    error: 'No redirect or embed URL returned from PesaPal SubmitOrder',
                    details: raw
                });
            }

            // Persist order tracking id and basic payment details
            const paymentDetailsUpdate = {
                pesapalOrderId: orderId,
                orderTrackingId: orderTrackingIdResp,
                status: 'initiated',
                initiatedAt: new Date(),
                initiatedAmount: orderData.amount
            };
            if (embedIframeSrc) paymentDetailsUpdate.embedIframe = embedIframeSrc;

            await Booking.findByIdAndUpdate(bookingId, {
                $set: { 'paymentDetails': paymentDetailsUpdate }
            });

            return res.json({
                success: true,
                redirectUrl: redirectUrl,
                orderTrackingId: orderTrackingIdResp,
                environment: this.environment,
                embedIframeSrc: embedIframeSrc,
                pesapalRaw: raw
            });

        } catch (error) {
            console.error('[PesaPal] Payment Error:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message || 'Payment initiation failed'
            });
        }
    }

    async handleCallback(req, res) {
        // Immediate acknowledgement for IPN (respond quickly to PesaPal)
        try {
            const rawPayload = { query: req.query || {}, body: req.body || {}, headers: req.headers || {}, receivedAt: new Date() };
            console.log('[PesaPal] IPN received (raw):', JSON.stringify(rawPayload).substring(0, 2000));
            // Send quick 200 OK to acknowledge receipt
            res.status(200).send('OK');

            // Process the callback asynchronously (do not rely on client waiting for this)
            (async () => {
                try {
                    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = rawPayload.query;

                    if (!OrderTrackingId) {
                        console.warn('[PesaPal] Callback missing OrderTrackingId - aborting async processing');
                        return;
                    }

                    // Optionally persist raw IPN to booking (if booking known) for audit
                    const bookingForIpn = await Booking.findOne({ 'paymentDetails.orderTrackingId': OrderTrackingId });
                    if (bookingForIpn) {
                        // Append to an ipn log array on the booking
                        const ipnEntry = { payload: rawPayload, receivedAt: new Date() };
                        await Booking.findByIdAndUpdate(bookingForIpn._id, { $push: { 'paymentDetails.ipn': ipnEntry } });
                    }

                    const token = await this.getAuthToken();

                    // Get transaction status from PesaPal
                    const response = await axios.get(
                        `${this.txBase}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        }
                    );

                    const { payment_status } = response.data;
                    console.log('[PesaPal] Transaction Status (async):', payment_status);

                    // Find booking by tracking ID
                    const booking = await Booking.findOne({ 'paymentDetails.orderTrackingId': OrderTrackingId });
                    if (!booking) {
                        console.warn('[PesaPal] No booking found for tracking ID (async):', OrderTrackingId);
                        return;
                    }

                    // Map status and extract amount
                    let bookingStatus = 'pending';
                    if (payment_status === 'COMPLETED') bookingStatus = 'confirmed';
                    else if (payment_status === 'FAILED') bookingStatus = 'cancelled';

                    const rawAmount = response.data?.amount || response.data?.payment_amount || response.data?.paid_amount || response.data?.transaction_amount || null;
                    const amountNumeric = rawAmount != null ? Number(rawAmount) : null;

                    const newAmountPaid = amountNumeric != null ? amountNumeric : (booking.amountPaid || 0);
                    const totalDue = booking.costs?.total || booking.total || 0;
                    const newPaymentTerm = (newAmountPaid >= totalDue && totalDue > 0) ? 'full' : (newAmountPaid > 0 ? 'deposit' : booking.paymentTerm || 'deposit');

                    const updateObj = {
                        'paymentDetails.status': payment_status,
                        'paymentDetails.completedAt': new Date(),
                        'paymentDetails.pesapalResponse': response.data,
                        status: bookingStatus,
                        amountPaid: newAmountPaid,
                        paymentTerm: newPaymentTerm
                    };

                    await Booking.findByIdAndUpdate(booking._id, { $set: updateObj });
                    console.log(`[PesaPal] Booking ${booking._id} updated (async) status: ${bookingStatus}, amountPaid: ${newAmountPaid}, paymentTerm: ${newPaymentTerm}`);

                } catch (err) {
                    console.error('[PesaPal] Async callback processing error:', err?.message || err);
                }
            })();

        } catch (error) {
            console.error('[PesaPal] Callback immediate ack error:', error?.message || error);
            try { res.status(500).json({ success: false, error: 'Failed to receive callback' }); } catch (e) { /* ignore */ }
        }
    }

    async checkPaymentStatus(req, res) {
        try {
            const { orderTrackingId } = req.query;

            if (!orderTrackingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing orderTrackingId'
                });
            }

            const token = await this.getAuthToken();
            
            const response = await axios.get(
                `${this.txBase}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            return res.json({
                success: true,
                status: response.data.payment_status,
                data: response.data
            });

        } catch (error) {
            console.error('[PesaPal] Status Check Error:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to check payment status'
            });
        }
    }

    // DEBUG: direct auth debug endpoint (returns raw auth response or error)
    async debugAuth(req, res) {
        try {
            const url = `${this.authBase}/api/Auth/RequestToken`;
            const payload = {
                consumer_key: consumerKey,
                consumer_secret: consumerSecret
            };
            // Call PesaPal auth endpoint directly and return the full response
            const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
            return res.json({ success: true, data: resp.data });
        } catch (err) {
            const details = err.response ? (err.response.data || err.response.statusText) : err.message;
            const status = err.response ? err.response.status : 500;
            return res.status(status).json({ success: false, error: 'Auth request failed', details });
        }
    }
}

const controller = new PesapalController();

export const submitOrder = controller.submitOrder.bind(controller);
export const handleCallback = controller.handleCallback.bind(controller);
export const checkPaymentStatus = controller.checkPaymentStatus.bind(controller);
export const debugAuth = controller.debugAuth.bind(controller);

export default controller;