// Orders Page Manager
class OrdersManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchTerm = '';
        this.statusFilter = '';
        this.dateFilter = '';
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
        // Orders page search
        const ordersSearchInput = document.getElementById('ordersSearchInput');
        if (ordersSearchInput) {
            ordersSearchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.applyFilters();
            });
        }

        // Date filter
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.dateFilter = e.target.value;
                this.applyFilters();
            });
        }

        // Header search (for product search)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (e.target.value.length > 0) {
                    window.location.href = `home.html?search=${encodeURIComponent(e.target.value)}`;
                }
            });
        }
    }

    applyFilters() {
        this.filteredOrders = this.orders.filter(order => {
            // Search filter
            if (this.searchTerm) {
                const orderId = order.id.toLowerCase();
                const itemNames = order.order_items?.map(item => 
                    item.items?.name?.toLowerCase() || ''
                ).join(' ') || '';
                
                if (!orderId.includes(this.searchTerm) && !itemNames.includes(this.searchTerm)) {
                    return false;
                }
            }

            // Status filter
            if (this.statusFilter && order.status !== this.statusFilter) {
                return false;
            }

            // Date filter
            if (this.dateFilter) {
                const orderDate = new Date(order.created_at);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);

                switch (this.dateFilter) {
                    case 'today':
                        if (orderDate < today) return false;
                        break;
                    case 'week':
                        if (orderDate < weekAgo) return false;
                        break;
                    case 'month':
                        if (orderDate < monthAgo) return false;
                        break;
                }
            }

            return true;
        });

        this.currentPage = 1;
        this.displayOrders();
        this.displayPagination();
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
                this.filteredOrders = [...this.orders];
                this.displayOrders();
                this.displayPagination();
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
        const ordersToDisplay = this.filteredOrders.length > 0 ? this.filteredOrders : this.orders;

        if (!ordersToDisplay || ordersToDisplay.length === 0) {
            ordersContent.innerHTML = `
                <div class="orders-empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>No orders found</p>
                    <a href="home.html" class="btn-primary">Start Shopping</a>
                </div>
            `;
            return;
        }

        // Paginate orders
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedOrders = ordersToDisplay.slice(startIndex, endIndex);

        ordersContent.innerHTML = paginatedOrders.map(order => {
            const orderDate = new Date(order.created_at);
            const formattedDate = orderDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            // Format order number (e.g., 123-456789)
            const orderParts = order.id.split('-');
            const orderNumber = orderParts.length > 1 
                ? `${orderParts[0].slice(-3)}-${orderParts[orderParts.length - 1].slice(0, 6)}` 
                : `123-${order.id.slice(-6)}`;
            const itemCount = order.order_items?.length || 0;
            const itemNames = order.order_items?.map(item => item.items?.name || 'Item').join(', ') || 'No items';
            const itemImages = order.order_items?.slice(0, 3).map(item => 
                item.items?.image_url || 'https://via.placeholder.com/50'
            ) || [];

            return `
                <div class="order-card-modern" onclick="viewOrderDetails('${order.id}')">
                    <div class="order-card-header">
                        <div class="order-number-section">
                            <h3>Order #${orderNumber}</h3>
                            <p class="order-placed">Placed on: ${formattedDate}</p>
                        </div>
                        <div class="order-status-section">
                            <span class="status-dot status-${order.status}"></span>
                            <span class="status-text">${this.getStatusText(order.status)}</span>
                        </div>
                    </div>
                    <div class="order-card-body">
                        <div class="order-items-preview">
                            ${itemImages.map(img => `
                                <div class="item-thumbnail">
                                    <img src="${img}" alt="Item">
                                </div>
                            `).join('')}
                        </div>
                        <div class="order-summary">
                            <p class="order-items-text">${itemNames}</p>
                            <p class="order-items-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</p>
                        </div>
                        <div class="order-total-section">
                            <span class="order-total-label">Total:</span>
                            <span class="order-total-amount">$${parseFloat(order.total_amount).toFixed(2)}</span>
                        </div>
                        <div class="order-arrow">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    displayPagination() {
        const paginationContainer = document.getElementById('ordersPagination');
        const ordersToDisplay = this.filteredOrders.length > 0 ? this.filteredOrders : this.orders;
        const totalPages = Math.ceil(ordersToDisplay.length / this.itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-controls">';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="window.ordersManager.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                paginationHTML += `
                    <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                            onclick="window.ordersManager.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="window.ordersManager.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        const ordersToDisplay = this.filteredOrders.length > 0 ? this.filteredOrders : this.orders;
        const totalPages = Math.ceil(ordersToDisplay.length / this.itemsPerPage);
        
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.displayOrders();
            this.displayPagination();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Processing',
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
