// Checkout Page Manager
class CheckoutManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.deliveryFee = 5.00;
        this.taxRate = 0.08; // 8% tax
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadOrderSummary();
        this.initializeStripe();
        this.populateUserInfo();
    }

    checkAuth() {
        if (this.token) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            this.currentUser = user;

            // Update profile image if available
            const profileImg = document.getElementById('userProfileImg');
            if (profileImg && user.profile_image_url) {
                profileImg.src = user.profile_image_url;
            }
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/';
        }

        // Check if cart is empty
        if (this.cart.length === 0) {
            this.showMessage('Your cart is empty. Please add items before checkout.', 'error');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 3000);
        }
    }

    setupEventListeners() {
        // Payment method change
        document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handlePaymentMethodChange(e.target.value);
            });
        });

        // Time slot selection
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                this.selectTimeSlot(e.currentTarget);
            });
        });

        // Continue to payment button
        const continueBtn = document.querySelector('.continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.continueToPayment();
            });
        }

        // Form validation
        const form = document.querySelector('.checkout-form-section');
        if (form) {
            form.addEventListener('input', () => {
                this.validateForm();
            });
        }
    }

    async initializeStripe() {
        try {
            // Initialize Stripe (you'll need to replace with your publishable key)
            this.stripe = Stripe('pk_test_your_stripe_publishable_key_here');

            // Create Elements instance
            this.elements = this.stripe.elements();

            // Create card element
            this.cardElement = this.elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#424770',
                        '::placeholder': {
                            color: '#aab7c4',
                        },
                    },
                },
            });

            // Mount card element
            this.cardElement.mount('#card-element');

            // Handle real-time validation errors
            this.cardElement.on('change', ({ error }) => {
                const displayError = document.getElementById('card-errors');
                if (error) {
                    displayError.textContent = error.message;
                } else {
                    displayError.textContent = '';
                }
            });

        } catch (error) {
            console.error('Error initializing Stripe:', error);
            this.showMessage('Payment system initialization failed', 'error');
        }
    }

    populateUserInfo() {
        if (this.currentUser) {
            // Pre-fill user information
            const emailInput = document.getElementById('contactEmail');
            const phoneInput = document.getElementById('contactPhone');

            if (emailInput) {
                emailInput.value = this.currentUser.email || '';
            }
            if (phoneInput) {
                phoneInput.value = this.currentUser.mobile_number || '';
            }
        }
    }

    loadOrderSummary() {
        this.updateOrderItems();
        this.updateOrderTotals();
    }

    updateOrderItems() {
        const orderItems = document.getElementById('orderItems');
        const summaryItems = document.getElementById('summaryItems');

        if (this.cart.length === 0) {
            orderItems.innerHTML = '<p>No items in cart</p>';
            summaryItems.innerHTML = '<p>No items in cart</p>';
            return;
        }

        const itemsHTML = this.cart.map(item => `
            <div class="order-item">
                <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}" class="item-image">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>Quantity: ${item.quantity}</p>
                    <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            </div>
        `).join('');

        orderItems.innerHTML = itemsHTML;
        summaryItems.innerHTML = itemsHTML;
    }

    updateOrderTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + this.deliveryFee + tax;

        // Update main totals
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('deliveryFee').textContent = `$${this.deliveryFee.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;

        // Update summary totals
        document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('summaryDelivery').textContent = `$${this.deliveryFee.toFixed(2)}`;
        document.getElementById('summaryTax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
    }

    handlePaymentMethodChange(method) {
        const stripeForm = document.getElementById('stripe-payment-form');

        if (method === 'card') {
            stripeForm.style.display = 'block';
        } else {
            stripeForm.style.display = 'none';
        }

        this.validateForm();
    }

    validateForm() {
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
        const deliveryTime = document.querySelector('input[name="deliveryTime"]:checked');
        const contactPhone = document.getElementById('contactPhone').value.trim();
        const contactEmail = document.getElementById('contactEmail').value.trim();
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');

        const isValid = deliveryAddress && deliveryTime && contactPhone && contactEmail && paymentMethod;

        if (paymentMethod && paymentMethod.value === 'card') {
            // Additional validation for card payment
            placeOrderBtn.disabled = !isValid || !this.cardElement;
        } else {
            placeOrderBtn.disabled = !isValid;
        }
    }

    async placeOrder() {
        try {
            const placeOrderBtn = document.getElementById('placeOrderBtn');
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            // Collect form data
            const orderData = this.collectOrderData();

            // Validate form
            if (!this.validateOrderData(orderData)) {
                throw new Error('Please fill in all required fields');
            }

            // Process payment if card is selected
            if (orderData.paymentMethod === 'card') {
                await this.processCardPayment(orderData);
            }

            // Create order
            const order = await this.createOrder(orderData);

            // Clear cart
            localStorage.removeItem('cart');

            // Show success message
            this.showMessage('Order placed successfully!', 'success');

            // Redirect to order confirmation
            setTimeout(() => {
                window.location.href = `order-confirmation.html?orderId=${order.id}`;
            }, 2000);

        } catch (error) {
            console.error('Error placing order:', error);
            this.showMessage(error.message || 'Failed to place order', 'error');

            // Re-enable button
            const placeOrderBtn = document.getElementById('placeOrderBtn');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
        }
    }

    collectOrderData() {
        return {
            deliveryAddress: document.getElementById('deliveryAddress').value.trim(),
            deliveryTime: document.querySelector('input[name="deliveryTime"]:checked')?.value,
            contactPhone: document.getElementById('contactPhone').value.trim(),
            contactEmail: document.getElementById('contactEmail').value.trim(),
            paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value,
            items: this.cart,
            subtotal: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            deliveryFee: this.deliveryFee,
            tax: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * this.taxRate,
            total: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + this.deliveryFee + (this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * this.taxRate)
        };
    }

    validateOrderData(orderData) {
        return orderData.deliveryAddress &&
            orderData.deliveryTime &&
            orderData.contactPhone &&
            orderData.contactEmail &&
            orderData.paymentMethod &&
            orderData.items.length > 0;
    }

    async processCardPayment(orderData) {
        try {
            // Create payment intent on server
            const response = await fetch('/api/user/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    amount: Math.round(orderData.total * 100), // Convert to cents
                    currency: 'usd'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create payment intent');
            }

            const { clientSecret } = await response.json();

            // Confirm payment with Stripe
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: this.cardElement,
                    billing_details: {
                        name: this.currentUser.name,
                        email: orderData.contactEmail,
                        phone: orderData.contactPhone,
                    },
                }
            });

            if (error) {
                throw new Error(error.message);
            }

            return paymentIntent;

        } catch (error) {
            console.error('Payment processing error:', error);
            throw new Error('Payment failed: ' + error.message);
        }
    }

    async createOrder(orderData) {
        try {
            const response = await fetch('/api/user/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    ...orderData,
                    userId: this.currentUser.id,
                    status: 'pending'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create order');
            }

            return await response.json();

        } catch (error) {
            console.error('Order creation error:', error);
            throw error;
        }
    }

    selectTimeSlot(selectedSlot) {
        // Remove selected class from all time slots
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Add selected class to clicked slot
        selectedSlot.classList.add('selected');
    }

    continueToPayment() {
        // Toggle the payment step
        this.toggleStep('payment');
    }

    toggleStep(stepType) {
        const deliveryStep = document.getElementById('deliveryStep');
        const paymentStep = document.getElementById('paymentStep');
        const deliveryContent = document.getElementById('deliveryContent');
        const paymentContent = document.getElementById('paymentContent');

        if (stepType === 'delivery') {
            deliveryStep.classList.toggle('active');
            deliveryContent.style.display = deliveryStep.classList.contains('active') ? 'block' : 'none';

            // Update chevron icon
            const deliveryIcon = deliveryStep.querySelector('.step-icon');
            deliveryIcon.className = deliveryStep.classList.contains('active') ? 'fas fa-chevron-up step-icon' : 'fas fa-chevron-down step-icon';
        } else if (stepType === 'payment') {
            paymentStep.classList.toggle('active');
            paymentContent.style.display = paymentStep.classList.contains('active') ? 'block' : 'none';

            // Update chevron icon
            const paymentIcon = paymentStep.querySelector('.step-icon');
            paymentIcon.className = paymentStep.classList.contains('active') ? 'fas fa-chevron-up step-icon' : 'fas fa-chevron-down step-icon';
        }
    }

    loadOrderSummary() {
        const orderItemsContainer = document.getElementById('orderItems');
        const subtotalElement = document.getElementById('subtotal');
        const taxElement = document.getElementById('tax');
        const totalElement = document.getElementById('total');

        if (!orderItemsContainer) return;

        // Clear existing items
        orderItemsContainer.innerHTML = '';

        if (this.cart.length === 0) {
            orderItemsContainer.innerHTML = '<p>Your cart is empty</p>';
            return;
        }

        let subtotal = 0;

        // Add cart items
        this.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.innerHTML = `
                <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}" class="item-image">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-quantity">Qty: ${item.quantity}</div>
                </div>
                <div class="item-price">$${itemTotal.toFixed(2)}</div>
            `;
            orderItemsContainer.appendChild(orderItem);
        });

        // Calculate totals
        const tax = subtotal * this.taxRate;
        const total = subtotal + this.deliveryFee + tax;

        // Update display
        if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
        if (taxElement) taxElement.textContent = `$${tax.toFixed(2)}`;
        if (totalElement) totalElement.textContent = `$${total.toFixed(2)}`;
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 3000;
            ${type === 'error' ? 'background: #dc3545;' : 'background: #28a745;'}
        `;

        document.body.appendChild(messageDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Global functions
window.openCart = function () {
    window.location.href = 'home.html';
};

window.toggleUserMenu = function () {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('show');
};

window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
};

window.filterByCategory = function (categoryName) {
    console.log('Filtering by category:', categoryName);
};

window.placeOrder = function () {
    const checkoutManager = window.checkoutManager;
    if (checkoutManager) {
        checkoutManager.placeOrder();
    }
};

window.toggleStep = function (stepType) {
    const checkoutManager = window.checkoutManager;
    if (checkoutManager) {
        checkoutManager.toggleStep(stepType);
    }
};

// Close user menu when clicking outside
document.addEventListener('click', function (event) {
    const userMenu = document.getElementById('userMenu');
    const userProfile = document.querySelector('.user-profile');

    if (userMenu && userProfile && !userProfile.contains(event.target)) {
        userMenu.classList.remove('show');
    }
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.checkoutManager = new CheckoutManager();
});
