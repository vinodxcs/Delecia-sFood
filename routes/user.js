const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Middleware to verify user token
const verifyUserToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

// Apply user middleware to all routes
router.use(verifyUserToken);

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const { data: userData, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', req.user.userId)
            .single();

        if (error) {
            return res.status(400).json({ error: 'User not found' });
        }

        res.json(userData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const { name, email, mobile_number, profile_image_url } = req.body;

        const { data: userData, error } = await supabaseAdmin
            .from('users')
            .update({
                name,
                email,
                mobile_number,
                profile_image_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.userId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            message: 'Profile updated successfully',
            user: userData
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user orders
router.get('/orders', async (req, res) => {
    try {
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    items (
                        name,
                        price,
                        image_url
                    )
                )
            `)
            .eq('user_id', req.user.userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(orders || []);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single order
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    items (
                        name,
                        price,
                        image_url
                    )
                )
            `)
            .eq('id', id)
            .eq('user_id', req.user.userId)
            .single();

        if (error) {
            return res.status(400).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create order
router.post('/orders', async (req, res) => {
    try {
        const {
            deliveryAddress,
            deliveryTime,
            contactPhone,
            contactEmail,
            paymentMethod,
            items,
            subtotal,
            deliveryFee,
            tax,
            total,
            status = 'pending'
        } = req.body;

        // Validate required fields
        if (!deliveryAddress || !deliveryTime || !contactPhone || !contactEmail || !paymentMethod || !items || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert([{
                user_id: req.user.userId,
                total_amount: total,
                status: status,
                shipping_address: deliveryAddress,
                delivery_time: deliveryTime,
                contact_phone: contactPhone,
                contact_email: contactEmail,
                payment_method: paymentMethod,
                subtotal: subtotal,
                delivery_fee: deliveryFee,
                tax: tax
            }])
            .select()
            .single();

        if (orderError) {
            return res.status(400).json({ error: orderError.message });
        }

        // Create order items
        const orderItems = items.map(item => ({
            order_id: order.id,
            item_id: item.id,
            quantity: item.quantity,
            price: item.price
        }));

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            // Rollback order creation
            await supabaseAdmin
                .from('orders')
                .delete()
                .eq('id', order.id);

            return res.status(400).json({ error: 'Failed to create order items' });
        }

        res.json({
            message: 'Order created successfully',
            order: order
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', req.user.userId)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: 'Order not found or update failed' });
        }

        res.json({
            message: 'Order status updated successfully',
            order: order
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create payment intent for Stripe
router.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'usd' } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency,
            metadata: {
                userId: req.user.userId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        console.error('Payment intent creation error:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Confirm payment
router.post('/confirm-payment', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment intent ID required' });
        }

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            res.json({
                message: 'Payment confirmed successfully',
                paymentIntent: paymentIntent
            });
        } else {
            res.status(400).json({ error: 'Payment not successful' });
        }
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// Get user cart (stored in localStorage, but can be synced to server)
router.get('/cart', async (req, res) => {
    try {
        // For now, return empty cart since we're using localStorage
        // In a real app, you might want to store cart on server
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save cart to server (optional)
router.post('/cart', async (req, res) => {
    try {
        const { items } = req.body;

        // Store cart items in a user_cart table or similar
        // This is optional since we're using localStorage
        res.json({ message: 'Cart saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search products
router.get('/search', async (req, res) => {
    try {
        const { q, category_id, limit = 20, offset = 0 } = req.query;

        let query = supabaseAdmin
            .from('items')
            .select(`
                *,
                categories:category_id (
                    id,
                    name,
                    parent_id
                )
            `)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit))
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        // Add search filter
        if (q) {
            query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
        }

        // Add category filter
        if (category_id && category_id !== 'all') {
            query = query.eq('category_id', category_id);
        }

        const { data: items, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            items: items || [],
            total: items ? items.length : 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get product details
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: product, error } = await supabaseAdmin
            .from('items')
            .select(`
                *,
                categories:category_id (
                    id,
                    name,
                    parent_id
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return res.status(400).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get categories for user
router.get('/categories', async (req, res) => {
    try {
        const { data: categories, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(categories || []);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get products by category
router.get('/products', async (req, res) => {
    try {
        const { category_id, subcategory_id, limit = 20, offset = 0, sort = 'name' } = req.query;

        let query = supabaseAdmin
            .from('items')
            .select(`
                *,
                categories:category_id (
                    id,
                    name,
                    parent_id
                )
            `)
            .limit(parseInt(limit))
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        // Add category filter
        if (category_id && category_id !== 'all') {
            query = query.eq('category_id', category_id);
        }

        // Add subcategory filter
        if (subcategory_id) {
            query = query.eq('category_id', subcategory_id);
        }

        // Add sorting
        switch (sort) {
            case 'price-low':
                query = query.order('price', { ascending: true });
                break;
            case 'price-high':
                query = query.order('price', { ascending: false });
                break;
            case 'newest':
                query = query.order('created_at', { ascending: false });
                break;
            default:
                query = query.order('name', { ascending: true });
        }

        const { data: items, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            products: items || [],
            total: items ? items.length : 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;