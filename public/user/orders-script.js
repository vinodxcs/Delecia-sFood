// Orders Page Manager
class OrdersManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.orders = [];
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadOrders();
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
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/user/orders', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.orders = await response.json();
                this.displayOrders();
            } else {
                this.showOrdersError();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showOrdersError();
        }
    }

    displayOrders() {
        const ordersContent = document.getElementById('ordersContent');

        if (!this.orders || this.orders.length === 0) {
            ordersContent.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>No orders found</p>
                    <a href="home.html" class="btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }

        ordersContent.innerHTML = this.orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-info">
                        <h3>Order #${order.id.slice(-8)}</h3>
                        <p class="order-date">${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="order-status">
                        <span class="status-badge ${order.status}">${this.getStatusText(order.status)}</span>
                    </div>
                </div>
                
                <div class="order-items">
                    ${order.order_items.map(item => `
                        <div class="order-item">
                            <img src="${item.items?.image_url || 'https://via.placeholder.com/60'}" 
                                 alt="${item.items?.name || 'Item'}" class="item-image">
                            <div class="item-info">
                                <h4>${item.items?.name || 'Unknown Item'}</h4>
                                <p>Quantity: ${item.quantity}</p>
                                <span class="item-price">$${item.price}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-footer">
                    <div class="order-total">
                        <span>Total: $${order.total_amount}</span>
                    </div>
                    <div class="order-actions">
                        <button class="btn-secondary" onclick="viewOrderDetails('${order.id}')">
                            View Details
                        </button>
                        ${order.status === 'pending' ? `
                            <button class="btn-danger" onclick="cancelOrder('${order.id}')">
                                Cancel Order
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'shipped': 'Shipped',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    showOrdersError() {
        const ordersContent = document.getElementById('ordersContent');
        ordersContent.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load orders. Please try again later.</p>
                <button class="btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    handleSearch(searchTerm) {
        if (searchTerm.length < 2) return;

        // Navigate to search results page
        window.location.href = `search.html?q=${encodeURIComponent(searchTerm)}`;
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

        // Auto remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
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

window.viewOrderDetails = function (orderId) {
    window.location.href = `order-details.html?id=${orderId}`;
};

window.cancelOrder = function (orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        const ordersManager = window.ordersManager;
        if (ordersManager) {
            ordersManager.cancelOrder(orderId);
        }
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
    window.ordersManager = new OrdersManager();
});
