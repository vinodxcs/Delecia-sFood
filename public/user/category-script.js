// Category Page Manager
class CategoryPageManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.categories = [];
        this.currentCategory = null;
        this.products = [];
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadCategories();
        this.loadCategoryFromURL();
        this.updateCartDisplay();
    }

    checkAuth() {
        if (!this.token) {
            window.location.href = '/';
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.currentUser = user;

        // Update user profile image if available
        const profileImg = document.getElementById('userProfileImg');
        if (profileImg && user.profile_image_url) {
            profileImg.src = user.profile_image_url;
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
        }

        // Filter controls
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortProducts(e.target.value);
            });
        }

        const saleFilter = document.getElementById('saleFilter');
        if (saleFilter) {
            saleFilter.addEventListener('click', () => {
                this.toggleSaleFilter();
            });
        }

        // Product grid click handlers
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn')) {
                const productId = e.target.closest('.add-to-cart-btn').dataset.productId;
                this.addToCart(productId);
            }
        });
    }

    loadCategoryFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const categoryId = urlParams.get('category');
        const categoryName = urlParams.get('name');

        if (categoryId && categoryName) {
            this.currentCategory = categoryId;
            this.updatePageTitle(categoryName);
            this.updateBreadcrumbs(categoryName);
            this.loadProducts(categoryId);
        } else {
            // Default to all products if no category specified
            this.loadProducts();
        }
    }

    updatePageTitle(categoryName) {
        document.getElementById('pageTitle').textContent = categoryName;
    }

    updateBreadcrumbs(categoryName) {
        const breadcrumbs = document.getElementById('breadcrumbs');
        breadcrumbs.innerHTML = `
            <span>Home</span>
            <span>${categoryName}</span>
        `;
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/admin/public-category-tree');

            if (response.ok) {
                const categories = await response.json();
                this.categories = categories;
                this.displayCategories(categories);
            } else {
                this.showCategoriesError();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showCategoriesError();
        }
    }

    displayCategories(categories) {
        const categoryTree = document.getElementById('categoryTree');

        if (!categories || categories.length === 0) {
            categoryTree.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No categories available</p>
                </div>
            `;
            return;
        }

        // Add "All Products" option
        let categoriesHTML = `
            <div class="category-item">
                <a href="home.html" class="category-link ${!this.currentCategory ? 'active' : ''}">
                    <i class="fas fa-th"></i>
                    <span>All Products</span>
                </a>
            </div>
        `;

        // Add main categories with recursive rendering
        categories.forEach(category => {
            categoriesHTML += this.renderCategoryRecursive(category, 0);
        });

        categoryTree.innerHTML = categoriesHTML;
    }

    renderCategoryRecursive(category, level = 0) {
        const hasChildren = category.children && category.children.length > 0;
        const iconClass = this.getCategoryIcon(category.name);
        const isActive = this.currentCategory === category.id;
        const indentClass = level > 0 ? 'subcategory-link' : 'category-link';
        const containerClass = level === 0 ? 'category-item' : 'nested-category-item';
        const subcategoryContainerClass = level === 0 ? 'subcategories' : 'nested-subcategories';
        
        let html = `
            <div class="${containerClass}">
                <div style="display: flex; align-items: center; width: 100%;">
                    <a href="category.html?category=${category.id}&name=${encodeURIComponent(category.name)}" 
                       class="${indentClass} ${isActive ? 'active' : ''}"
                       style="flex: 1;">
                        ${level > 0 ? '<i class="fas fa-circle"></i>' : `<i class="${iconClass}"></i>`}
                        <span>${category.name}</span>
                    </a>
                    ${hasChildren ? `
                        <button class="expand-toggle-btn" 
                                onclick="event.stopPropagation(); toggleSubcategories('${category.id}');" 
                                style="background: none; border: none; padding: 8px; cursor: pointer; color: #666;">
                            <i class="fas fa-chevron-right expand-icon" id="icon-${category.id}"></i>
                        </button>
                    ` : ''}
                </div>
                ${hasChildren ? `
                    <div class="${subcategoryContainerClass} ${isActive ? 'show' : ''}" id="subcategories-${category.id}">
                        ${category.children.map(child => this.renderCategoryRecursive(child, level + 1)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        return html;
    }

    getCategoryIcon(categoryName) {
        const iconMap = {
            'Fruits': 'fas fa-apple-alt',
            'Vegetables': 'fas fa-carrot',
            'Dairy & Eggs': 'fas fa-egg',
            'Meat & Poultry': 'fas fa-drumstick-bite',
            'Bakery': 'fas fa-bread-slice',
            'Beverages': 'fas fa-coffee',
            'Grocery': 'fas fa-shopping-basket'
        };
        return iconMap[categoryName] || 'fas fa-tag';
    }

    showCategoriesError() {
        const categoryTree = document.getElementById('categoryTree');
        categoryTree.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load categories. Please try again later.</p>
            </div>
        `;
    }

    async loadProducts(categoryId = null) {
        try {
            let url = '/api/admin/public-items?limit=50';
            if (categoryId) {
                url += `&category_id=${categoryId}`;
            }
            const response = await fetch(url);

            if (response.ok) {
                const products = await response.json();
                this.products = products;
                this.displayProducts();
                this.updatePagination(products.length);
                this.updateProductsCount(products.length);
            } else {
                // If API fails, load sample products for demo
                this.loadSampleProducts();
            }
        } catch (error) {
            console.error('Error loading products:', error);
            // If API fails, load sample products for demo
            this.loadSampleProducts();
        }
    }

    loadSampleProducts() {
        this.products = [
            {
                id: '1',
                name: 'Organic Tomatoes',
                price: '2.99',
                description: 'Fresh organic tomatoes',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '2',
                name: 'Free-Range Chicken',
                price: '8.99',
                description: 'Premium free-range chicken',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '3',
                name: 'Sourdough Bread',
                price: '5.49',
                description: 'Artisan sourdough bread',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '4',
                name: 'Whole Milk',
                price: '3.99',
                description: 'Fresh whole milk',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '5',
                name: 'Fresh Strawberries',
                price: '4.99',
                description: 'Sweet fresh strawberries',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '6',
                name: 'Orange Juice',
                price: '4.29',
                description: 'Fresh squeezed orange juice',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            }
        ];
        this.displayProducts();
        this.updatePagination(this.products.length);
        this.updateProductsCount(this.products.length);
    }

    displayProducts() {
        const productsGrid = document.getElementById('productsGrid');

        if (!this.products || this.products.length === 0) {
            productsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-box-open"></i>
                    <p>No products found</p>
                </div>
            `;
            return;
        }

        productsGrid.innerHTML = this.products.map(product => {
            const imageUrl = product.image_url || 'https://via.placeholder.com/280x200';
            const isOnSale = Math.random() > 0.7; // Random sale badge for demo
            const originalPrice = isOnSale ? (parseFloat(product.price) * 1.3).toFixed(2) : null;

            // Check if product is in cart
            const cartItem = this.cart.find(item => item.id === product.id);
            const isInCart = cartItem ? cartItem.quantity : 0;

            return `
                <div class="product-card">
                    ${isOnSale ? '<div class="sale-badge">Sale</div>' : ''}
                    <img src="${imageUrl}" alt="${product.name}" class="product-image">
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-description">${product.description || 'Fresh and delicious'}</p>
                        <div class="product-price">
                            $${product.price}
                            ${originalPrice ? `<span style="text-decoration: line-through; color: #666; font-size: 0.9rem; margin-left: 10px;">$${originalPrice}</span>` : ''}
                        </div>
                        ${isInCart > 0 ? `
                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="updateQuantity('${product.id}', -1)">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="quantity-display">${isInCart}</span>
                                <button class="quantity-btn" onclick="updateQuantity('${product.id}', 1)">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        ` : `
                            <button class="add-to-cart-btn" data-product-id="${product.id}">
                                <i class="fas fa-shopping-cart"></i>
                                Add to Cart
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateProductsCount(count) {
        const productsCount = document.getElementById('productsCount');
        if (productsCount) {
            productsCount.textContent = `Showing ${count} products`;
        }
    }

    updatePagination(totalItems) {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(totalItems / 50);

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `<button class="page-btn" onclick="changePage(1)">
            <i class="fas fa-chevron-left"></i>
        </button>`;

        // Page numbers
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            paginationHTML += `<button class="page-btn ${i === 1 ? 'active' : ''}" 
                onclick="changePage(${i})">${i}</button>`;
        }

        // Next button
        paginationHTML += `<button class="page-btn" onclick="changePage(${totalPages})">
            <i class="fas fa-chevron-right"></i>
        </button>`;

        pagination.innerHTML = paginationHTML;
    }

    async addToCart(productId) {
        try {
            // Find the product
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                this.showMessage('Product not found', 'error');
                return;
            }

            // Check if product is already in cart
            const existingItem = this.cart.find(item => item.id === productId);

            if (existingItem) {
                existingItem.quantity++;
            } else {
                this.cart.push({ ...product, quantity: 1 });
            }

            localStorage.setItem('cart', JSON.stringify(this.cart));
            this.updateCartDisplay();
            this.showMessage(`${product.name} added to cart!`, 'success');
            this.displayProducts(); // Re-render products to update "Add to Cart" buttons
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showMessage('Failed to add to cart', 'error');
        }
    }

    updateCartDisplay() {
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            cartCount.textContent = this.cart.length;
        }
    }

    showMessage(message, type) {
        // Create a simple message display
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            ${type === 'error' ? 'background: #dc3545;' : 'background: #28a745;'}
        `;

        document.body.appendChild(messageDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // Cart functionality
    openCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');

        cartSidebar.classList.add('open');
        cartOverlay.classList.add('open');
        this.displayCartItems();
    }

    closeCart() {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');

        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('open');
    }

    displayCartItems() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Your cart is empty</p>';
            cartTotal.textContent = '0.00';
            return;
        }

        let total = 0;
        cartItems.innerHTML = this.cart.map(item => {
            const itemTotal = parseFloat(item.price) * item.quantity;
            total += itemTotal;

            return `
                <div class="cart-item">
                    <img src="${item.image_url || 'https://via.placeholder.com/70'}" alt="${item.name}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p>$${item.price} each</p>
                    </div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        cartTotal.textContent = total.toFixed(2);
    }

    updateCartQuantity(productId, change) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                this.cart = this.cart.filter(item => item.id !== productId);
            }
            localStorage.setItem('cart', JSON.stringify(this.cart));
            this.updateCartDisplay();
            this.displayCartItems();
        }
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.updateCartDisplay();
        this.displayCartItems();
    }

    proceedToCheckout() {
        if (this.cart.length === 0) {
            alert('Your cart is empty');
            return;
        }
        window.location.href = 'checkout.html';
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('cart');
        window.location.href = '/';
    }
}

// Global functions
window.openCart = function () {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.openCart();
    }
};

window.closeCart = function () {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.closeCart();
    }
};

window.updateCartQuantity = function (productId, change) {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.updateCartQuantity(productId, change);
    }
};

window.removeFromCart = function (productId) {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.removeFromCart(productId);
    }
};

window.proceedToCheckout = function () {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.proceedToCheckout();
    }
};

window.logout = function () {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.logout();
    }
};

window.toggleUserMenu = function () {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('show');
};

window.updateQuantity = function (productId, change) {
    const categoryManager = window.categoryPageManager;
    if (categoryManager) {
        categoryManager.addToCart(productId);
    }
};

window.toggleSubcategories = function (categoryId) {
    const subcategories = document.getElementById(`subcategories-${categoryId}`);
    const expandIcon = document.getElementById(`icon-${categoryId}`);

    if (subcategories) {
        subcategories.classList.toggle('show');
        if (expandIcon) {
            if (subcategories.classList.contains('show')) {
                expandIcon.style.transform = 'rotate(90deg)';
            } else {
                expandIcon.style.transform = 'rotate(0deg)';
            }
        }
    }
};

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userProfile = document.querySelector('.user-profile');

    if (!userProfile.contains(e.target)) {
        userMenu.classList.remove('show');
    }
});

// Initialize category page manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.categoryPageManager = new CategoryPageManager();
});