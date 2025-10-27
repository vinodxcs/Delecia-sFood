// User Home Page Manager
class UserHomeManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.categories = [];
        this.featuredProducts = [];
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadCategories();
        this.loadProducts();
        this.updateCartDisplay();
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

        // Cart functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart-btn')) {
                const productId = e.target.dataset.productId;
                this.addToCart(productId);
            }
        });
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
                <a href="#" class="category-link active" onclick="navigateToCategory(null, 'All Products')">
                    <i class="fas fa-th"></i>
                    <span>All Products</span>
                </a>
            </div>
        `;

        // Add main categories
        categories.forEach(category => {
            const hasChildren = category.children && category.children.length > 0;
            const iconClass = this.getCategoryIcon(category.name);

            categoriesHTML += `
                <div class="category-item">
                    <a href="category.html?category=${category.id}&name=${encodeURIComponent(category.name)}" 
                       class="category-link ${hasChildren ? 'expandable' : ''}" 
                       ${hasChildren ? `onclick="toggleSubcategories('${category.id}'); return false;"` : ''}>
                        <i class="${iconClass}"></i>
                        <span>${category.name}</span>
                        ${hasChildren ? '<i class="fas fa-chevron-right expand-icon"></i>' : ''}
                    </a>
                    ${hasChildren ? `
                        <div class="subcategories" id="subcategories-${category.id}">
                            ${category.children.map(subcategory => `
                                <a href="category.html?category=${subcategory.id}&name=${encodeURIComponent(subcategory.name)}" 
                                   class="subcategory-link">
                                    <i class="fas fa-circle"></i>
                                    <span>${subcategory.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        categoryTree.innerHTML = categoriesHTML;
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

    navigateToCategory(categoryId, categoryName) {
        if (categoryId) {
            // Navigate to category page
            window.location.href = `category.html?category=${categoryId}&name=${encodeURIComponent(categoryName)}`;
        } else {
            // Stay on home page for "All Products"
            this.currentCategory = null;
            this.updateBreadcrumbs('All Products');
            document.getElementById('pageTitle').textContent = 'All Products';
            this.updateActiveCategory(null);
            this.loadProducts();
        }
    }

    updateBreadcrumbs(categoryName) {
        const breadcrumbs = document.getElementById('breadcrumbs');
        breadcrumbs.innerHTML = `
            <span>Home</span>
            ${categoryName !== 'All Products' ? `<span>${categoryName}</span>` : ''}
        `;
    }

    updateActiveCategory(categoryId) {
        // Remove active class from all category links
        document.querySelectorAll('.category-link, .subcategory-link').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to selected category
        if (categoryId) {
            const activeLink = document.querySelector(`[onclick*="navigateToCategory('${categoryId}'"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        } else {
            // All Products is active
            const allProductsLink = document.querySelector('[onclick*="navigateToCategory(null"]');
            if (allProductsLink) {
                allProductsLink.classList.add('active');
            }
        }
    }

    updateProductsCount(count) {
        const productsCount = document.getElementById('productsCount');
        if (productsCount) {
            productsCount.textContent = `Showing ${count} products`;
        }
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
            },
            {
                id: '7',
                name: 'Baby Spinach',
                price: '3.49',
                description: 'Fresh baby spinach leaves',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '8',
                name: 'Ground Beef',
                price: '6.99',
                description: 'Premium ground beef',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '9',
                name: 'Avocados',
                price: '2.49',
                description: 'Fresh ripe avocados',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '10',
                name: 'Greek Yogurt',
                price: '4.79',
                description: 'Creamy Greek yogurt',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '11',
                name: 'Bananas',
                price: '1.99',
                description: 'Fresh yellow bananas',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '12',
                name: 'Salmon Fillet',
                price: '12.99',
                description: 'Fresh Atlantic salmon',
                image_url: 'https://images.unsplash.com/photo-1546470427-4b1b0b0b0b0b?w=300&h=200&fit=crop'
            },
            {
                id: '13',
                name: 'Eggs',
                price: '3.49',
                description: 'Fresh farm eggs',
                image_url: 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=300&h=200&fit=crop'
            },
            {
                id: '14',
                name: 'Ladiesfinger',
                price: '2.99',
                description: 'Fresh okra',
                image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300&h=200&fit=crop'
            },
            {
                id: '15',
                name: 'Guava',
                price: '4.49',
                description: 'Sweet tropical guava',
                image_url: 'https://images.unsplash.com/photo-1587132117010-57d3883bc16a?w=300&h=200&fit=crop'
            },
            {
                id: '16',
                name: 'Banana',
                price: '1.99',
                description: 'Fresh yellow bananas',
                image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=200&fit=crop'
            },
            {
                id: '17',
                name: 'Organic Orange',
                price: '3.99',
                description: 'Fresh organic oranges',
                image_url: 'https://images.unsplash.com/photo-1557800634-7bf3ed73b8e0?w=300&h=200&fit=crop'
            },
            {
                id: '18',
                name: 'Cadbury Miniatures',
                price: '5.99',
                description: 'Chocolate assortment',
                image_url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=300&h=200&fit=crop'
            },
            {
                id: '19',
                name: 'Fresh Apples',
                price: '3.49',
                description: 'Crisp red apples',
                image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=300&h=200&fit=crop'
            },
            {
                id: '20',
                name: 'Cheddar Cheese',
                price: '6.99',
                description: 'Aged cheddar cheese',
                image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300&h=200&fit=crop'
            },
            {
                id: '21',
                name: 'Fresh Milk',
                price: '2.99',
                description: 'Whole fresh milk',
                image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=200&fit=crop'
            },
            {
                id: '22',
                name: 'Organic Bananas',
                price: '2.49',
                description: 'Organic yellow bananas',
                image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=200&fit=crop'
            }
        ];
        this.displayProducts();
        this.updatePagination(this.products.length);
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
            const originalPrice = isOnSale ? (product.price * 1.3).toFixed(2) : null;

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

    updatePagination(totalItems) {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(totalItems / 20);

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
                existingItem.quantity += 1;
            } else {
                this.cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                    quantity: 1
                });
            }

            // Save to localStorage
            localStorage.setItem('cart', JSON.stringify(this.cart));

            // Update cart display
            this.updateCartDisplay();

            // Show success message
            this.showMessage(`${product.name} added to cart!`, 'success');

        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showMessage('Failed to add item to cart', 'error');
        }
    }

    updateCartDisplay() {
        // Update cart count
        const cartCount = document.getElementById('cartCount');
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;

        // Update cart items in sidebar
        this.updateCartSidebar();
    }

    updateCartSidebar() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');

        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                </div>
            `;
            cartTotal.textContent = '0.00';
            return;
        }

        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <img src="${item.image_url || 'https://via.placeholder.com/60'}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" 
                               onchange="updateQuantity('${item.id}', 0, this.value)">
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');

        // Calculate total
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = total.toFixed(2);
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

    filterProductsByCategory(category) {
        // In a real app, this would make an API call to filter products
        // For now, we'll just reload all products
        this.loadProducts();
    }

    showProductsError() {
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load products. Please try again later.</p>
            </div>
        `;
    }
}

// Global functions
window.navigateToCategory = function (categoryId, categoryName) {
    window.location.href = `category.html?id=${categoryId}&name=${encodeURIComponent(categoryName)}`;
};

window.openCart = function () {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');

    cartSidebar.classList.add('open');
    cartOverlay.classList.add('show');
};

window.closeCart = function () {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');

    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('show');
};

window.updateQuantity = function (productId, change, newValue) {
    const userHomeManager = window.userHomeManager;
    if (!userHomeManager) return;

    const item = userHomeManager.cart.find(item => item.id === productId);
    if (!item) return;

    if (newValue !== undefined) {
        item.quantity = Math.max(1, parseInt(newValue));
    } else {
        item.quantity = Math.max(1, item.quantity + change);
    }

    localStorage.setItem('cart', JSON.stringify(userHomeManager.cart));
    userHomeManager.updateCartDisplay();
};

window.removeFromCart = function (productId) {
    const userHomeManager = window.userHomeManager;
    if (!userHomeManager) return;

    userHomeManager.cart = userHomeManager.cart.filter(item => item.id !== productId);
    localStorage.setItem('cart', JSON.stringify(userHomeManager.cart));
    userHomeManager.updateCartDisplay();
};

window.proceedToCheckout = function () {
    const userHomeManager = window.userHomeManager;
    if (!userHomeManager || userHomeManager.cart.length === 0) {
        userHomeManager.showMessage('Your cart is empty', 'error');
        return;
    }

    window.location.href = 'checkout.html';
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

window.scrollToProducts = function () {
    document.querySelector('.products-section').scrollIntoView({
        behavior: 'smooth'
    });
};

window.filterProducts = function (category) {
    const userHomeManager = window.userHomeManager;
    if (!userHomeManager) return;

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // Update products title
    const productsTitle = document.getElementById('productsTitle');
    if (category === 'all') {
        productsTitle.textContent = 'Showing All Products';
    } else {
        productsTitle.textContent = `Showing ${category.charAt(0).toUpperCase() + category.slice(1)} Products`;
    }

    // Filter products (in a real app, this would make an API call)
    userHomeManager.filterProductsByCategory(category);
};

window.changePage = function (page) {
    const userHomeManager = window.userHomeManager;
    if (userHomeManager) {
        userHomeManager.currentPage = page;
        userHomeManager.loadProducts();
        window.scrollTo(0, 0);
    }
};

window.filterByCategory = function (categoryName) {
    // This would filter products by category
    console.log('Filtering by category:', categoryName);
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
// Global functions for category navigation
window.navigateToCategory = function (categoryId, categoryName) {
    const homeManager = window.userHomeManager;
    if (homeManager) {
        homeManager.navigateToCategory(categoryId, categoryName);
    }
};

window.toggleSubcategories = function (categoryId) {
    const subcategories = document.getElementById(`subcategories-${categoryId}`);
    const categoryLink = document.querySelector(`[onclick*="toggleSubcategories('${categoryId}')"]`);

    if (subcategories && categoryLink) {
        subcategories.classList.toggle('show');
        categoryLink.classList.toggle('expanded');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.userHomeManager = new UserHomeManager();
});
