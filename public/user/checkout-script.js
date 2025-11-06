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
        this.savedAddresses = JSON.parse(localStorage.getItem('savedAddresses') || '[]');
        this.init();
    }

    async init() {
        try {
            this.checkAuth();
            this.setupEventListeners();
            this.loadOrderSummary();
            // Initialize Stripe asynchronously without blocking
            this.initializeStripe().catch(err => {
                console.warn('Stripe initialization failed, continuing without Stripe:', err);
            });
            this.populateUserInfo();
            // Initial form validation
            setTimeout(() => this.validateForm(), 100);
        } catch (error) {
            console.error('Error initializing checkout:', error);
            // Show error but allow page to continue
            this.showMessage('Some features may not be available. Please refresh the page.', 'error');
        }
    }

    async createOrder(orderData) {
        try {
            // Get fresh token before making request
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Authentication token not found. Please login again.');
            }

            if (!this.currentUser || !this.currentUser.id) {
                throw new Error('User information not found. Please login again.');
            }

            console.log('Sending order data to server:', {
                ...orderData,
                userId: this.currentUser.id,
                status: 'pending'
            });
            
            // Ensure items have required fields
            const items = orderData.items.map(item => ({
                id: item.id,
                quantity: item.quantity,
                price: parseFloat(item.price)
            }));
            
            const requestBody = {
                deliveryAddress: orderData.deliveryAddress,
                deliveryTime: orderData.deliveryTime,
                contactPhone: orderData.contactPhone,
                contactEmail: orderData.contactEmail,
                paymentMethod: orderData.paymentMethod,
                items: items,
                subtotal: parseFloat(orderData.subtotal),
                deliveryFee: parseFloat(orderData.deliveryFee),
                tax: parseFloat(orderData.tax),
                total: parseFloat(orderData.total),
                status: 'pending'
            };
            
            console.log('Request body:', requestBody);
            console.log('Using token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
            
            const response = await fetch('/api/user/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            let responseData;
            try {
                responseData = await response.json();
            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                throw new Error(`Server returned invalid response (Status: ${response.status})`);
            }

            console.log('Server response status:', response.status);
            console.log('Server response data:', responseData);

            if (!response.ok) {
                console.error('Order creation failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData
                });
                
                // Handle authentication errors
                if (response.status === 401 || response.status === 400) {
                    const errorMessage = responseData.error || 'Authentication failed';
                    if (errorMessage.includes('token') || errorMessage.includes('Invalid')) {
                        // Clear invalid token and redirect to login
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        this.showMessage('Your session has expired. Please login again.', 'error');
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 3000);
                        throw new Error('Session expired. Please login again.');
                    }
                }
                
                const errorMessage = responseData.error || responseData.message || `Failed to create order (Status: ${response.status})`;
                throw new Error(errorMessage);
            }

            return responseData.order || responseData;

        } catch (error) {
            console.error('Order creation error:', error);
            // Re-throw with more context if it's a network error
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                throw new Error('Network error: Could not connect to server. Please check your internet connection.');
            }
            throw error;
        }
    }

    setupEventListeners() {
        // Payment method change
        document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handlePaymentMethodChange(e.target.value);
            });
        });

        // Time slot selection - now using radio buttons
        document.querySelectorAll('input[name="deliveryTime"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectTimeSlot(e.target.closest('.time-slot'));
            });
        });

        // Click on time slot labels to select
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const radio = slot.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    radio.checked = true;
                    this.selectTimeSlot(slot);
                }
            });
        });

        // Continue to payment button
        const continueBtn = document.querySelector('.continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.continueToPayment();
            });
        }

        // Address input fields - update combined address
        const addressFields = ['streetAddress', 'city', 'state', 'zipCode', 'country'];
        addressFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    this.updateCombinedAddress();
                    this.validateForm();
                });
                field.addEventListener('change', () => {
                    this.updateCombinedAddress();
                    this.validateForm();
                });
            }
        });

        // Contact information fields
        const contactEmail = document.getElementById('contactEmail');
        const contactPhone = document.getElementById('contactPhone');
        
        if (contactEmail) {
            contactEmail.addEventListener('input', () => {
                this.validateForm();
            });
        }
        if (contactPhone) {
            contactPhone.addEventListener('input', () => {
                this.validateForm();
            });
        }

        // Add Address button
        const addAddressBtn = document.getElementById('addAddressBtn');
        if (addAddressBtn) {
            addAddressBtn.addEventListener('click', () => {
                this.openAddressModal();
            });
        }

        // Address Modal handlers
        const addressModal = document.getElementById('addressModal');
        const closeModalBtn = document.getElementById('closeAddressModal');
        const cancelBtn = document.getElementById('cancelAddressBtn');
        const addressForm = document.getElementById('addressForm');

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeAddressModal();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeAddressModal();
            });
        }

        if (addressForm) {
            addressForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAddress();
            });
        }

        // Close modal when clicking outside
        if (addressModal) {
            addressModal.addEventListener('click', (e) => {
                if (e.target === addressModal) {
                    this.closeAddressModal();
                }
            });
        }

        // Load saved addresses
        this.loadSavedAddresses();
    }

    updateCombinedAddress() {
        const street = document.getElementById('streetAddress')?.value.trim() || '';
        const city = document.getElementById('city')?.value.trim() || '';
        const state = document.getElementById('state')?.value.trim() || '';
        const zip = document.getElementById('zipCode')?.value.trim() || '';
        const country = document.getElementById('country')?.value || '';

        const addressParts = [street, city, state, zip];
        if (country) {
            const countryName = document.getElementById('country')?.selectedOptions[0]?.text || country;
            addressParts.push(countryName);
        }
        
        const combinedAddress = addressParts.filter(Boolean).join(', ');
        const deliveryAddressField = document.getElementById('deliveryAddress');
        if (deliveryAddressField) {
            deliveryAddressField.value = combinedAddress;
        }
    }

    openAddressModal() {
        const modal = document.getElementById('addressModal');
        if (modal) {
            modal.style.display = 'block';
            // Clear form
            document.getElementById('modalStreetAddress').value = '';
            document.getElementById('modalCity').value = '';
            document.getElementById('modalState').value = '';
            document.getElementById('modalZipCode').value = '';
            document.getElementById('modalCountry').value = 'US';
            document.getElementById('modalAddressLabel').value = '';
        }
    }

    closeAddressModal() {
        const modal = document.getElementById('addressModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    saveAddress() {
        const street = document.getElementById('modalStreetAddress').value.trim();
        const city = document.getElementById('modalCity').value.trim();
        const state = document.getElementById('modalState').value.trim();
        const zip = document.getElementById('modalZipCode').value.trim();
        const country = document.getElementById('modalCountry').value || '';
        const label = document.getElementById('modalAddressLabel').value.trim();

        if (!street || !city || !state || !zip || !label || !country) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        const countryName = document.getElementById('modalCountry').selectedOptions[0]?.text || country;
        const address = {
            id: Date.now().toString(),
            label: label,
            street: street,
            city: city,
            state: state,
            zip: zip,
            country: country,
            countryName: countryName,
            fullAddress: `${street}, ${city}, ${state} ${zip}, ${countryName}`
        };

        this.savedAddresses.push(address);
        localStorage.setItem('savedAddresses', JSON.stringify(this.savedAddresses));
        
        this.loadSavedAddresses();
        this.closeAddressModal();
        this.showMessage('Address saved successfully!', 'success');
    }

    loadSavedAddresses() {
        const container = document.getElementById('savedAddressesContainer');
        if (!container) return;

        if (this.savedAddresses.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">No saved addresses yet. Add one below!</p>';
            return;
        }

        container.innerHTML = this.savedAddresses.map(addr => `
            <div class="address-option" data-address-id="${addr.id}">
                <div class="address-card">
                    <div class="address-label">${addr.label}</div>
                    <div class="address-text">${addr.fullAddress || `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.countryName || ''}`}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers to address cards
        container.querySelectorAll('.address-card').forEach(card => {
            card.addEventListener('click', () => {
                const addressOption = card.closest('.address-option');
                const addressId = addressOption?.dataset.addressId;
                const address = this.savedAddresses.find(a => a.id === addressId);
                
                if (address) {
                    // Remove selected class from all
                    container.querySelectorAll('.address-card').forEach(c => {
                        c.classList.remove('selected');
                    });
                    
                    // Add selected to clicked
                    card.classList.add('selected');
                    
                    // Fill form fields
                    document.getElementById('streetAddress').value = address.street;
                    document.getElementById('city').value = address.city;
                    document.getElementById('state').value = address.state;
                    document.getElementById('zipCode').value = address.zip;
                    if (address.country && document.getElementById('country')) {
                        document.getElementById('country').value = address.country;
                    }
                    if (document.getElementById('addressLabel')) {
                        document.getElementById('addressLabel').value = address.label;
                    }
                    
                    this.updateCombinedAddress();
                    this.validateForm();
                }
            });
        });
    }

    async initializeStripe() {
        try {
            // Check if Stripe is loaded
            if (typeof Stripe === 'undefined') {
                console.warn('Stripe.js library not loaded');
                this.setDefaultPaymentMethod();
                return;
            }

            // Fetch Stripe publishable key from server
            let stripeKey;
            try {
                const response = await fetch('/api/user/stripe-publishable-key');
                if (response.ok) {
                    const data = await response.json();
                    stripeKey = data.publishableKey;
                } else {
                    console.warn('Stripe publishable key not configured on server');
                    this.setDefaultPaymentMethod();
                    return;
                }
            } catch (error) {
                console.warn('Failed to fetch Stripe publishable key:', error);
                this.setDefaultPaymentMethod();
                return;
            }

            if (!stripeKey || stripeKey.includes('your_stripe')) {
                console.warn('Stripe publishable key not configured');
                this.setDefaultPaymentMethod();
                return;
            }

            // Initialize Stripe with error handling
            try {
                this.stripe = Stripe(stripeKey);
            } catch (stripeError) {
                console.warn('Failed to initialize Stripe:', stripeError);
                this.setDefaultPaymentMethod();
                return;
            }

            // Create Elements instance
            if (!this.stripe) {
                this.setDefaultPaymentMethod();
                return;
            }
            
            this.elements = this.stripe.elements();

            // Create card element
            const cardElementContainer = document.getElementById('card-element');
            if (!cardElementContainer) {
                console.warn('Card element container not found');
                this.setDefaultPaymentMethod();
                return;
            }

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
                // Hide postal code field in card element since we're providing it in billing_details
                hidePostalCode: true
            });

            // Mount card element
            this.cardElement.mount('#card-element');

            // Handle real-time validation errors
            this.cardElement.on('change', ({ error }) => {
                const displayError = document.getElementById('card-errors');
                if (error) {
                    if (displayError) displayError.textContent = error.message;
                } else {
                    if (displayError) displayError.textContent = '';
                }
            });

            // Update form validation after Stripe is ready
            this.validateForm();

        } catch (error) {
            console.warn('Error initializing Stripe (non-critical):', error);
            this.setDefaultPaymentMethod();
            // Don't throw - allow checkout to work without Stripe
        }
    }

    setDefaultPaymentMethod() {
        // Set cash on delivery as default if Stripe isn't available
        const cashRadio = document.querySelector('input[name="paymentMethod"][value="cash"]');
        const cardRadio = document.querySelector('input[name="paymentMethod"][value="card"]');
        
        if (cashRadio && !document.querySelector('input[name="paymentMethod"]:checked')) {
            cashRadio.checked = true;
        }
        
        // Hide card payment option if Stripe isn't available
        if (cardRadio && !this.stripe) {
            const cardLabel = cardRadio.closest('.payment-method');
            if (cardLabel) {
                cardLabel.style.display = 'none';
            }
        }
        
        this.validateForm();
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
            // Only show Stripe form if Stripe is configured
            if (this.stripe && this.cardElement) {
                stripeForm.style.display = 'block';
            } else {
                // Hide Stripe form and show warning
                stripeForm.style.display = 'none';
                this.showMessage('Card payment is not available. Stripe is not configured. Please select cash on delivery.', 'error');
                
                // Automatically select cash on delivery
                const cashRadio = document.querySelector('input[name="paymentMethod"][value="cash"]');
                if (cashRadio) {
                    cashRadio.checked = true;
                    method = 'cash';
                }
            }
        } else {
            stripeForm.style.display = 'none';
        }

        this.validateForm();
    }

    validateForm() {
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        if (!placeOrderBtn) return;

        // Check address fields
        const street = document.getElementById('streetAddress')?.value.trim() || '';
        const city = document.getElementById('city')?.value.trim() || '';
        const state = document.getElementById('state')?.value.trim() || '';
        const zip = document.getElementById('zipCode')?.value.trim() || '';
        const country = document.getElementById('country')?.value || '';
        const deliveryAddress = street && city && state && zip && country;
        
        const contactPhoneEl = document.getElementById('contactPhone');
        const contactEmailEl = document.getElementById('contactEmail');
        const deliveryTime = document.querySelector('input[name="deliveryTime"]:checked');
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');

        const contactPhone = contactPhoneEl ? contactPhoneEl.value.trim() : '';
        const contactEmail = contactEmailEl ? contactEmailEl.value.trim() : '';

        const isValid = deliveryAddress && deliveryTime && contactPhone && contactEmail && paymentMethod;

        if (paymentMethod && paymentMethod.value === 'card') {
            // Additional validation for card payment
            placeOrderBtn.disabled = !isValid || !this.cardElement;
        } else {
            placeOrderBtn.disabled = !isValid;
        }
    }

    async placeOrder() {
        const placeOrderBtn = document.getElementById('placeOrderBtn');
        
        if (!placeOrderBtn) {
            console.error('Place order button not found');
            this.showMessage('Error: Order button not found. Please refresh the page.', 'error');
            return;
        }

        try {
            console.log('Starting placeOrder process...');
            placeOrderBtn.disabled = true;
            placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            // Collect form data
            const orderData = this.collectOrderData();
            console.log('Order data collected:', orderData);

            // Validate form
            if (!this.validateOrderData(orderData)) {
                console.error('Validation failed:', orderData);
                throw new Error('Please fill in all required fields');
            }

            // Process payment if card is selected
            if (orderData.paymentMethod === 'card') {
                if (!this.stripe || !this.cardElement) {
                    throw new Error('Card payment is not available. Please select cash on delivery or configure Stripe.');
                }
                console.log('Processing card payment...');
                await this.processCardPayment(orderData);
            }

            // Create order
            console.log('Creating order...');
            const order = await this.createOrder(orderData);
            console.log('Order created successfully:', order);

            // Clear cart
            localStorage.removeItem('cart');

            // Show success message
            this.showMessage('Order placed successfully!', 'success');

            // Redirect to orders page since we don't have order-confirmation.html
            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 2000);

        } catch (error) {
            console.error('Error placing order:', error);
            const errorMessage = error.message || 'Failed to place order. Please try again.';
            this.showMessage(errorMessage, 'error');

            // Re-enable button
            if (placeOrderBtn) {
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
            }
        }
    }

    collectOrderData() {
        // Build address from separate fields
        const street = document.getElementById('streetAddress')?.value.trim() || '';
        const city = document.getElementById('city')?.value.trim() || '';
        const state = document.getElementById('state')?.value.trim() || '';
        const zip = document.getElementById('zipCode')?.value.trim() || '';
        const countryEl = document.getElementById('country');
        const country = countryEl ? countryEl.value : '';
        const countryName = countryEl ? countryEl.selectedOptions[0]?.text : '';
        
        const addressParts = [street, city, state, zip, countryName];
        const deliveryAddress = addressParts.filter(Boolean).join(', ');
        
        const contactPhoneEl = document.getElementById('contactPhone');
        const contactEmailEl = document.getElementById('contactEmail');
        const deliveryTime = document.querySelector('input[name="deliveryTime"]:checked');
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + this.deliveryFee + tax;

        return {
            deliveryAddress: deliveryAddress,
            street: street,
            city: city,
            state: state,
            zipCode: zip,
            country: country || 'US',
            deliveryTime: deliveryTime ? deliveryTime.value : '',
            contactPhone: contactPhoneEl ? contactPhoneEl.value.trim() : '',
            contactEmail: contactEmailEl ? contactEmailEl.value.trim() : '',
            paymentMethod: paymentMethod ? paymentMethod.value : '',
            items: this.cart,
            subtotal: subtotal,
            deliveryFee: this.deliveryFee,
            tax: tax,
            total: total
        };
    }

    validateOrderData(orderData) {
        const isValid = orderData.deliveryAddress &&
            orderData.deliveryTime &&
            orderData.contactPhone &&
            orderData.contactEmail &&
            orderData.paymentMethod &&
            orderData.items.length > 0;
        
        // Additional validation for card payment
        if (orderData.paymentMethod === 'card') {
            if (!orderData.zipCode || orderData.zipCode.trim() === '') {
                console.error('ZIP code missing for card payment:', orderData);
                return false;
            }
        }
        
        return isValid;
    }

    async processCardPayment(orderData) {
        try {
            // Get ZIP code directly from form to ensure we have the latest value
            const zipCodeEl = document.getElementById('zipCode');
            const zipCode = zipCodeEl ? zipCodeEl.value.trim() : (orderData.zipCode || '');
            
            console.log('ZIP Code validation:', {
                fromForm: zipCodeEl?.value.trim(),
                fromOrderData: orderData.zipCode,
                finalZipCode: zipCode
            });

            // Validate ZIP code is present
            if (!zipCode) {
                throw new Error('Postal code is required for card payment. Please enter your ZIP code in the ZIP Code field.');
            }

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

            // Get address fields directly from form
            const street = document.getElementById('streetAddress')?.value.trim() || orderData.street || '';
            const city = document.getElementById('city')?.value.trim() || orderData.city || '';
            const state = document.getElementById('state')?.value.trim() || orderData.state || '';
            const countryEl = document.getElementById('country');
            let country = countryEl ? countryEl.value : (orderData.country || 'US');
            
            // Handle "OTHER" country option - default to US for Stripe (can accept any postal code format)
            if (country === 'OTHER' || !country) {
                country = 'US'; // Default for Stripe payment processing
            }
            
            // Validate postal code is not empty
            // Format validation is handled by Stripe based on country
            if (zipCode.trim() === '') {
                throw new Error('Postal code is required for card payment. Please enter your postal code.');
            }

            const billingAddress = {
                line1: street,
                city: city,
                state: state,
                postal_code: zipCode.trim(),
                country: country
            };

            console.log('Stripe billing details:', {
                postal_code: zipCode,
                postal_code_length: zipCode.length,
                street: street,
                city: city,
                state: state,
                country: country,
                full_address: billingAddress
            });

            // Confirm payment with Stripe - include postal code in billing address
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: this.cardElement,
                    billing_details: {
                        name: this.currentUser.name,
                        email: orderData.contactEmail,
                        phone: orderData.contactPhone,
                        address: billingAddress
                    },
                }
            });

            if (error) {
                console.error('Stripe payment error:', error);
                throw new Error(error.message);
            }

            return paymentIntent;

        } catch (error) {
            console.error('Payment processing error:', error);
            throw new Error('Payment failed: ' + error.message);
        }
    }

    checkAuth() {
        // Get fresh token from localStorage
        this.token = localStorage.getItem('token');
        
        if (!this.token) {
            // Redirect to login if not authenticated
            this.showMessage('Please login to continue', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user || !user.id) {
            // User data is missing
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            this.showMessage('Session expired. Please login again', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }

        this.currentUser = user;

        // Update profile image if available
        const profileImg = document.getElementById('userProfileImg');
        if (profileImg && user.profile_image_url) {
            profileImg.src = user.profile_image_url;
        }

        // Check if cart is empty
        if (this.cart.length === 0) {
            this.showMessage('Your cart is empty. Please add items before checkout.', 'error');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 3000);
        }
    }

    selectTimeSlot(selectedSlot) {
        if (!selectedSlot) return;
        
        // Remove selected class from all time slots
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Add selected class to clicked slot
        selectedSlot.classList.add('selected');
        
        // Trigger validation
        this.validateForm();
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
    console.log('Place Order button clicked');
    const checkoutManager = window.checkoutManager;
    if (checkoutManager) {
        console.log('CheckoutManager found, calling placeOrder()');
        checkoutManager.placeOrder().catch(error => {
            console.error('Error in placeOrder:', error);
            alert('Failed to place order: ' + (error.message || 'Unknown error'));
        });
    } else {
        console.error('CheckoutManager not initialized');
        alert('Checkout system not ready. Please refresh the page.');
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
