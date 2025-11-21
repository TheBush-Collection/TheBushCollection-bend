import { environment, consumerKey, consumerSecret, callbackUrl } from '../config/pesapal.js';
import axios from 'axios';
import { randomUUID } from 'crypto';
import Booking from '../models/booking.model.js';

class PesapalController {
    constructor() {
        this.baseUrl = environment === 'live' 
            ? 'https://pay.pesapal.com/v3'
            : 'https://cybqa.pesapal.com/v3';
        this.environment = environment;
    }

    async getAuthToken() {
        try {
            const response = await axios.post(`${this.baseUrl}/api/Auth/RequestToken`, {
                consumer_key: consumerKey,
                consumer_secret: consumerSecret
            });
            
            if (!response.data.token) {
                throw new Error('No token in response');
            }
            
            console.log(`[PesaPal] Auth token obtained (${this.environment} mode)`);
            return response.data.token;
        } catch (error) {
            console.error('[PesaPal] Auth Error:', error.response?.data || error.message);
            // Return a mock token for development if credentials fail
            if (this.environment === 'sandbox') {
                console.warn('[PesaPal] Returning mock token for sandbox development');
                return 'mock_token_dev_' + Date.now();
            }
            throw new Error('Failed to get PesaPal auth token: ' + error.message);
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

            // Check if booking exists
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    error: 'Booking not found'
                });
            }

            const token = await this.getAuthToken();
            
            const orderId = randomUUID();
            const orderData = {
                id: orderId,
                currency: currency || 'KES',
                amount: parseFloat(amount),
                description: description || `Booking Payment - ${bookingReference || bookingId}`,
                callback_url: callbackUrl,
                redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/confirmation`,
                notification_id: `notify_${bookingId}`,
                billing_address: {
                    email_address: email,
                    phone_number: phoneNumber || '',
                    first_name: firstName || 'Guest',
                    last_name: lastName || 'Booking',
                    country_code: 'KE'
                }
            };

            console.log('[PesaPal] Submitting order:', orderId, 'Amount:', amount);

            const response = await axios.post(
                `${this.baseUrl}/api/Transactions/SubmitOrder`,
                orderData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('[PesaPal] Order submitted successfully:', response.data.order_tracking_id);

            // Store order tracking ID in booking
            await Booking.findByIdAndUpdate(bookingId, {
                $set: {
                    'paymentDetails.pesapalOrderId': orderId,
                    'paymentDetails.orderTrackingId': response.data.order_tracking_id,
                    'paymentDetails.status': 'initiated',
                    'paymentDetails.initiatedAt': new Date()
                }
            });

            return res.json({
                success: true,
                redirectUrl: response.data.redirect_url,
                orderTrackingId: response.data.order_tracking_id,
                environment: this.environment
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
        try {
            const { 
                OrderTrackingId,
                OrderMerchantReference,
                OrderNotificationType
            } = req.query;

            console.log('[PesaPal] Callback received:', { OrderTrackingId, OrderNotificationType });

            if (!OrderTrackingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing OrderTrackingId'
                });
            }

            const token = await this.getAuthToken();
            
            // Get transaction status from PesaPal
            const response = await axios.get(
                `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const { payment_status, description } = response.data;

            console.log('[PesaPal] Transaction Status:', payment_status);

            // Find booking by notification ID
            const booking = await Booking.findOne({
                'paymentDetails.orderTrackingId': OrderTrackingId
            });

            if (booking) {
                // Map PesaPal status to booking status
                let bookingStatus = 'pending';
                if (payment_status === 'COMPLETED') {
                    bookingStatus = 'confirmed';
                } else if (payment_status === 'FAILED') {
                    bookingStatus = 'cancelled';
                } else if (payment_status === 'PENDING') {
                    bookingStatus = 'pending';
                }

                // Update booking with payment status
                await Booking.findByIdAndUpdate(booking._id, {
                    $set: {
                        'paymentDetails.status': payment_status,
                        'paymentDetails.completedAt': new Date(),
                        'paymentDetails.pesapalResponse': response.data,
                        status: bookingStatus
                    }
                });

                console.log(`[PesaPal] Booking ${booking._id} updated with status: ${bookingStatus}`);
            } else {
                console.warn('[PesaPal] No booking found for tracking ID:', OrderTrackingId);
            }

            return res.json({
                success: true,
                status: payment_status,
                message: `Payment ${payment_status.toLowerCase()}`
            });

        } catch (error) {
            console.error('[PesaPal] Callback Error:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to process payment callback'
            });
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
                `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
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
}

const controller = new PesapalController();

export const submitOrder = controller.submitOrder.bind(controller);
export const handleCallback = controller.handleCallback.bind(controller);
export const checkPaymentStatus = controller.checkPaymentStatus.bind(controller);

export default controller;