// Admin Dashboard functionality
class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.categories = [];
        this.products = [];
        this.currentCategoryFilter = 'all';
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadDashboardData();
    }

    checkAuth() {
        if (!this.token) {
            console.log('No token found, redirecting to login');
            window.location.href = '/';
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') {
            console.log('User is not admin, redirecting to login');
            window.location.href = '/';
            return;
        }

        this.currentUser = user;
        console.log('Admin authenticated:', user);

        // Update user profile image if available
        const profileImg = document.querySelector('.profile-img');
        if (profileImg && user.profile_image_url) {
            profileImg.src = user.profile_image_url;
        }

        // Update user name if element exists
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = user.name;
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.showPage(page);
                this.setActiveNav(item);
            });
        });

        // Header navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.showPage(page);
                this.setActiveHeaderNav(link);
            });
        });

        // Category form
        const categoryForm = document.getElementById('category-form');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCategorySubmit();
            });
        }

        // Search functionality
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            productSearch.addEventListener('input', (e) => {
                this.filterProducts(e.target.value);
            });
        }

        const categorySearch = document.getElementById('category-search');
        if (categorySearch) {
            categorySearch.addEventListener('input', (e) => {
                this.filterCategories(e.target.value);
            });
        }

        // Filter tabs
		document.querySelectorAll('.filter-tab').forEach(tab => {
			// For products page filter buttons
			if (tab.dataset.filter) {
				tab.addEventListener('click', () => {
					this.setActiveFilter(tab);
					this.filterProductsByStatus(tab.dataset.filter);
				});
			}
			// For orders page status filter buttons
			if (tab.dataset.status) {
				tab.addEventListener('click', () => {
					// Toggle active in orders filter group
					document.querySelectorAll('#orders-content .filter-tab').forEach(t => t.classList.remove('active'));
					tab.classList.add('active');
				});
			}
		});

		// Orders apply filter
		const ordersApplyBtn = document.getElementById('orders-apply-filter');
		if (ordersApplyBtn) {
			ordersApplyBtn.addEventListener('click', () => this.loadOrders());
		}
    }

    showPage(page) {
        // Hide all content
        document.querySelectorAll('.content').forEach(content => {
            content.classList.add('hidden');
        });

        // Show selected page
        const targetContent = document.getElementById(`${page}-content`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }

        // Load page-specific data
		if (page === 'products') {
            this.loadProducts();
            this.loadCategoryTree();
		} else if (page === 'categories') {
            this.loadCategories();
		} else if (page === 'orders') {
			this.loadOrders();
        }
    }

    setActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    setActiveHeaderNav(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data with token:', this.token ? 'Present' : 'Missing');
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Dashboard response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Dashboard data:', data);
                document.getElementById('categories-count').textContent = data.categories || 0;
                document.getElementById('items-count').textContent = data.items || 0;
                document.getElementById('orders-count').textContent = data.orders || 0;
            } else {
                const error = await response.json();
                console.error('Dashboard error:', error);
                this.showMessage('Failed to load dashboard data: ' + (error.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showMessage('Network error loading dashboard data', 'error');
        }
    }

    async loadProducts() {
        try {
            console.log('Loading products...');
            const response = await fetch('/api/admin/items', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const products = await response.json();
                console.log('Products loaded:', products);
                this.products = products;
                this.displayProducts(products);
            } else {
                console.error('Failed to load products:', response.status);
                this.showMessage('Failed to load products', 'error');
                this.displayProducts([]);
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.showMessage('Error loading products. Please try again.', 'error');
            this.displayProducts([]);
        }
    }

    displayProducts(products) {
        const tbody = document.getElementById('products-table-body');

        if (!products || products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        <i class="fas fa-box-open"></i>
                        <p>No products found</p>
                        <small>Products will appear here once you add them</small>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('Displaying products:', products);

        tbody.innerHTML = products.map(product => {
            const categoryPath = this.buildCategoryPath(product);
            const imageUrl = product.image_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgzMFYzMEgyMFYyMFoiIGZpbGw9IiNDQ0MiLz4KPHBhdGggZD0iTTE1IDE1SDM1VjM1SDE1VjE1WiIgc3Ryb2tlPSIjQ0NDIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';

            return `
                <tr>
                    <td>
                        <div class="product-info">
                            <img src="${imageUrl}" alt="${product.name}" class="product-img" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgzMFYzMEgyMFYyMFoiIGZpbGw9IiNDQ0MiLz4KPHBhdGggZD0iTTE1IDE1SDM1VjM1SDE1VjE1WiIgc3Ryb2tlPSIjQ0NDIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+'">
                            <span>${product.name}</span>
                        </div>
                    </td>
                    <td>
                        <span class="category-path">${categoryPath}</span>
                    </td>
                    <td>$${product.price}</td>
                    <td>${product.stock || 0}</td>
                    <td>
                        <span class="status-badge ${product.status || 'active'}">${product.status || 'Active'}</span>
                    </td>
                    <td>
                        <a href="#" class="edit-link" onclick="editProduct('${product.id}')">Edit</a>
                        <a href="#" class="delete-link" onclick="deleteProduct('${product.id}')" style="color: #dc3545; margin-left: 10px;">Delete</a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    buildCategoryPath(product) {
        if (!product.categories) return 'No Category';

        // Find the full category path
        const categoryId = product.category_id;
        const category = this.categories.find(cat => cat.id === categoryId);

        if (!category) return product.categories.name || 'Unknown';

        const path = [];
        let currentCategory = category;

        // Build path from root to current category
        while (currentCategory) {
            path.unshift(currentCategory.name);
            currentCategory = this.categories.find(cat => cat.id === currentCategory.parent_id);
        }

        return path.join(' → ');
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            const response = await fetch('/api/admin/categories', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Categories response status:', response.status);

            if (response.ok) {
                const categories = await response.json();
                console.log('Categories loaded:', categories);
                this.categories = categories;
                this.displayCategories(categories);
                this.populateParentCategoryDropdown(categories);
            } else {
                const error = await response.json();
                console.error('Categories error:', error);
                this.showMessage('Failed to load categories: ' + (error.error || 'Unknown error'), 'error');
                this.showCategoriesError();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showMessage('Network error loading categories. Please try again.', 'error');
            this.showCategoriesError();
        }
    }

    showCategoriesError() {
        const container = document.getElementById('categories-list');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>Failed to load categories. Please check your connection and try again.</p>
                    <button onclick="createSampleData()" style="background: #ff6b6b; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                        Create Sample Data
                    </button>
                </div>
            `;
        }
    }

    populateParentCategoryDropdown(categories) {
        const parentSelect = document.getElementById('parent-category');
        if (!parentSelect) return;

        // Clear existing options except the first one
        parentSelect.innerHTML = '<option value="">Select Parent Category (Optional)</option>';

        // Build hierarchical options - allow any category to be a parent
        const buildOptions = (cats, level = 0) => {
            cats.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = '  '.repeat(level) + category.name;
                option.dataset.level = level;
                parentSelect.appendChild(option);

                // Add subcategories as indented options
                const subcategories = categories.filter(cat => cat.parent_id === category.id);
                if (subcategories.length > 0) {
                    buildOptions(subcategories, level + 1);
                }
            });
        };

        // Start with root categories (no parent)
        const rootCategories = categories.filter(cat => !cat.parent_id);
        buildOptions(rootCategories);
    }

    displayCategories(categories) {
        const container = document.getElementById('categories-list');

        if (!categories || categories.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; color: #ffc107;"></i>
                    <p>No categories found. This might be because:</p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Database is not set up properly</li>
                        <li>Supabase credentials are missing</li>
                        <li>No categories have been created yet</li>
                    </ul>
                    <button onclick="createSampleData()" style="background: #ff6b6b; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                        Create Sample Data
                    </button>
                </div>
            `;
            return;
        }

        console.log('Displaying categories:', categories);

        // Build hierarchical structure
        const categoryMap = new Map();
        const rootCategories = [];

        // First pass: create all category objects
        categories.forEach(cat => {
            categoryMap.set(cat.id, {
                ...cat,
                children: []
            });
        });

        // Second pass: build hierarchy
        categories.forEach(cat => {
            if (cat.parent_id && categoryMap.has(cat.parent_id)) {
                categoryMap.get(cat.parent_id).children.push(categoryMap.get(cat.id));
            } else if (!cat.parent_id) {
                rootCategories.push(categoryMap.get(cat.id));
            }
        });

        console.log('Root categories:', rootCategories);

        // Render hierarchical structure
        container.innerHTML = this.renderCategoryHierarchy(rootCategories, 0);
    }

    renderCategoryHierarchy(categories, level) {
        return categories.map(category => {
            const indent = '  '.repeat(level);
            const hasChildren = category.children && category.children.length > 0;
            const levelClass = level === 0 ? 'main-category' : level === 1 ? 'subcategory' : 'sub-subcategory';

            return `
                <div class="category-item ${levelClass} hierarchy-level-${level}" data-id="${category.id}">
                    <div class="category-content">
                        <i class="fas fa-grip-vertical"></i>
                        <span class="category-name">${indent}${category.name}</span>
                        <div class="category-actions">
                            <button class="edit-btn" onclick="editCategory('${category.id}', '${category.name}', '${category.parent_id || ''}')" title="Edit Category">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-btn" onclick="deleteCategory('${category.id}')" title="Delete Category">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${hasChildren ? `
                        <div class="subcategories">
                            ${this.renderCategoryHierarchy(category.children, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async loadCategoryTree() {
        try {
            const response = await fetch('/api/admin/public-categories', {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const categories = await response.json();
                this.categories = categories;
                this.displayCategoryTree(categories);
            } else {
                this.showCategoryTreeError();
            }
        } catch (error) {
            console.error('Error loading category tree:', error);
            this.showCategoryTreeError();
        }
    }

    displayCategoryTree(categories) {
        const container = document.getElementById('category-tree');

        if (!categories || categories.length === 0) {
            container.innerHTML = `
                <div class="no-categories">
                    <p>No categories available</p>
                    <button onclick="createSampleData()" class="btn-sample">Create Sample Data</button>
                </div>
            `;
            return;
        }

        // Get root categories (no parent)
        const rootCategories = categories.filter(cat => !cat.parent_id);

        container.innerHTML = `
            <div class="category-tree-item active" 
                 data-category-id="all" 
                 onclick="filterProductsByCategory('all')">
                <i class="fas fa-th-large"></i> All Products
            </div>
            ${rootCategories.map(category => {
            const hasChildren = categories.some(cat => cat.parent_id === category.id);
            return `
                    <div class="category-tree-item ${hasChildren ? 'has-children' : ''}" 
                         data-category-id="${category.id}" 
                         onclick="filterProductsByCategory('${category.id}')">
                        <i class="fas fa-folder"></i> ${category.name}
                    </div>
                `;
        }).join('')}
        `;
    }

    showCategoryTreeError() {
        const container = document.getElementById('category-tree');
        container.innerHTML = `
            <div class="error-state">
                <p>Failed to load categories</p>
            </div>
        `;
    }

    async handleCategorySubmit() {
        const name = document.getElementById('category-name').value;
        const parentId = document.getElementById('parent-category').value;

        if (!name.trim()) {
            this.showMessage('Please enter a category name', 'error');
            return;
        }

        try {
            this.showLoading(true);
            const response = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    name: name.trim(),
                    parent_id: parentId === '' ? null : parentId
                })
            });

            if (response.ok) {
                this.showMessage('Category created successfully!', 'success');
                document.getElementById('category-form').reset();
                this.loadCategories();
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to create category', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    filterProducts(searchTerm) {
        const rows = document.querySelectorAll('#products-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            row.style.display = matches ? '' : 'none';
        });
    }

    filterCategories(searchTerm) {
        const items = document.querySelectorAll('.category-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            item.style.display = matches ? '' : 'none';
        });
    }

    setActiveFilter(activeTab) {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        activeTab.classList.add('active');
    }

    filterProductsByStatus(status) {
        console.log('Filtering by status:', status);
        // Implementation for status filtering
    }

	async loadOrders() {
		try {
			const startDateInput = document.getElementById('orders-start-date');
			const endDateInput = document.getElementById('orders-end-date');
			const activeStatus = document.querySelector('#orders-content .filter-tab.active');
			const status = activeStatus ? activeStatus.dataset.status : 'all';

			const params = new URLSearchParams();
			if (startDateInput && startDateInput.value) params.set('start_date', new Date(startDateInput.value).toISOString());
			if (endDateInput && endDateInput.value) {
				// Include full day by setting end to 23:59:59Z
				const end = new Date(endDateInput.value);
				end.setUTCHours(23, 59, 59, 999);
				params.set('end_date', end.toISOString());
			}
			if (status && status !== 'all') params.set('status', status);

			const url = `/api/admin/orders${params.toString() ? `?${params.toString()}` : ''}`;
			const response = await fetch(url, {
				headers: {
					'Authorization': `Bearer ${this.token}`
				}
			});

			if (!response.ok) {
				this.displayOrders([]);
				return;
			}

			const orders = await response.json();
			this.displayOrders(orders || []);
		} catch (error) {
			console.error('Error loading orders:', error);
			this.displayOrders([]);
		}
	}

	displayOrders(orders) {
		const tbody = document.getElementById('orders-table-body');
		if (!tbody) return;

		if (!orders || orders.length === 0) {
			tbody.innerHTML = `
				<tr>
					<td colspan="7" class="no-data">
						<i class="fas fa-box-open"></i>
						<p>No orders found</p>
					</td>
				</tr>
			`;
			return;
		}

		tbody.innerHTML = orders.map(order => {
			const date = new Date(order.created_at);
			const itemsCount = Array.isArray(order.order_items) ? order.order_items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
			const customer = order.users ? `${order.users.name || 'Customer'} (${order.users.email || ''})` : (order.contact_email || '—');
			const tracking = order.tracking_status ? `<div class="small" style="color:#666;">${order.tracking_status}${order.tracking_note ? ` • ${order.tracking_note}` : ''}</div>` : '';

			const statusBadge = `<span class="status-badge ${order.status}">${order.status}</span>`;

			return `
				<tr>
					<td>${date.toLocaleDateString()}<div class="small" style="color:#666;">${date.toLocaleTimeString()}</div></td>
					<td>${order.id.substring(0, 8)}…</td>
					<td>${customer}</td>
					<td>${itemsCount}</td>
					<td>$${Number(order.total_amount || 0).toFixed(2)}</td>
					<td>${statusBadge}${tracking}</td>
					<td>
						<div style="display:flex; gap:6px; flex-wrap:wrap;">
							<button class="btn-secondary" onclick="updateOrderStatus('${order.id}','confirmed')">Confirm</button>
							<button class="btn-secondary" onclick="updateOrderStatus('${order.id}','shipped')">Ship</button>
							<button class="btn-secondary" onclick="updateOrderStatus('${order.id}','delivered')">Deliver</button>
						</div>
					</td>
				</tr>
			`;
		}).join('');
	}

	async updateOrderStatus(orderId, status) {
		try {
			const payload = { status };
			if (status === 'shipped') payload.tracking_status = 'In transit';
			if (status === 'delivered') payload.tracking_status = 'Delivered';

			const response = await fetch(`/api/admin/orders/${orderId}/status`, {
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${this.token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				this.showMessage('Failed to update order', 'error');
				return;
			}

			this.showMessage('Order updated', 'success');
			this.loadOrders();
		} catch (error) {
			this.showMessage('Network error updating order', 'error');
		}
	}

    showLoading(show) {
        const form = document.getElementById('category-form');
        const submitBtn = form?.querySelector('button[type="submit"]');

        if (form && submitBtn) {
            if (show) {
                form.classList.add('loading');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            } else {
                form.classList.remove('loading');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Category';
            }
        }
    }

    async editCategory(id, name, parentId = null) {
        const newName = prompt('Enter new category name:', name);
        if (!newName || newName.trim() === '') return;

        try {
            const response = await fetch(`/api/admin/categories/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    name: newName.trim(),
                    parent_id: parentId
                })
            });

            if (response.ok) {
                this.showMessage('Category updated successfully!', 'success');
                this.loadCategories();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to update category', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async deleteCategory(id) {
        if (!confirm('Are you sure you want to delete this category? This will also delete all subcategories and items in this category.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/categories/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showMessage('Category deleted successfully!', 'success');
                this.loadCategories();
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to delete category', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async editProduct(id) {
        // For now, just show a message - you can implement edit modal later
        this.showMessage('Edit product functionality coming soon!', 'success');
    }

    async deleteProduct(id) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/items/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showMessage('Product deleted successfully!', 'success');
                this.loadProducts();
                this.loadDashboardData();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to delete product', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    filterProductsByCategory(categoryId) {
        // Update active category in tree
        document.querySelectorAll('.category-tree-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = document.querySelector(`[data-category-id="${categoryId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Update breadcrumb
        this.updateBreadcrumb(categoryId);

        // Filter products
        if (categoryId === 'all') {
            this.displayProducts(this.products);
        } else {
            const filteredProducts = this.products.filter(product => {
                return product.category_id === categoryId ||
                    this.isProductInCategory(product, categoryId);
            });
            this.displayProducts(filteredProducts);
        }
    }

    isProductInCategory(product, categoryId) {
        // Check if product belongs to this category or any of its subcategories
        const category = this.categories.find(cat => cat.id === categoryId);
        if (!category) return false;

        // Check direct category match
        if (product.category_id === categoryId) return true;

        // Check if product's category is a subcategory of the selected category
        const productCategory = this.categories.find(cat => cat.id === product.category_id);
        if (!productCategory) return false;

        // Check if product category is a descendant of the selected category
        return this.isDescendantCategory(productCategory, categoryId);
    }

    isDescendantCategory(category, ancestorId) {
        if (!category.parent_id) return false;
        if (category.parent_id === ancestorId) return true;

        const parentCategory = this.categories.find(cat => cat.id === category.parent_id);
        if (!parentCategory) return false;

        return this.isDescendantCategory(parentCategory, ancestorId);
    }

    updateBreadcrumb(categoryId) {
        const breadcrumb = document.getElementById('category-breadcrumb');
        if (!breadcrumb) return;

        if (categoryId === 'all') {
            breadcrumb.innerHTML = '<span class="breadcrumb-item active" data-category-id="all">All Products</span>';
        } else {
            const category = this.categories.find(cat => cat.id === categoryId);
            if (category) {
                const path = this.buildCategoryPath(category);
                breadcrumb.innerHTML = `
                    <span class="breadcrumb-item" data-category-id="all" onclick="filterProductsByCategory('all')">All Products</span>
                    <span class="breadcrumb-item active" data-category-id="${categoryId}">${path}</span>
                `;
            }
        }
    }

    buildCategoryPath(category) {
        const path = [];
        let currentCategory = category;

        while (currentCategory) {
            path.unshift(currentCategory.name);
            currentCategory = this.categories.find(cat => cat.id === currentCategory.parent_id);
        }

        return path.join(' → ');
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
            z-index: 1000;
            ${type === 'error' ? 'background: #dc3545;' : 'background: #28a745;'}
        `;

        document.body.appendChild(messageDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    async logout() {
        try {
            // Call logout API
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Clear local storage regardless of API response
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login page
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            // Still clear local storage and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    }
}

// Global functions for category management
window.editCategory = function (id, name, parentId = null) {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.editCategory(id, name, parentId);
    }
};

window.deleteCategory = function (id) {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.deleteCategory(id);
    }
};

// Global functions for product management
window.editProduct = function (id) {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.editProduct(id);
    }
};

window.deleteProduct = function (id) {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.deleteProduct(id);
    }
};

// Global functions for orders management
window.updateOrderStatus = function (orderId, status) {
	const dashboard = window.adminDashboard;
	if (dashboard) {
		dashboard.updateOrderStatus(orderId, status);
	}
};

// Global function for creating sample data
window.createSampleData = async function () {
    try {
        const response = await fetch('/api/admin/create-sample-data', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            window.adminDashboard.showMessage('Sample data created successfully!', 'success');
            window.adminDashboard.loadCategories();
            window.adminDashboard.loadDashboardData();
        } else {
            const error = await response.json();
            window.adminDashboard.showMessage('Failed to create sample data: ' + error.error, 'error');
        }
    } catch (error) {
        window.adminDashboard.showMessage('Network error creating sample data', 'error');
    }
};

// Global function for filtering products by category
window.filterProductsByCategory = function (categoryId) {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.filterProductsByCategory(categoryId);
    }
};

// Global functions for category tree management
window.expandAllCategories = function () {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.expandAllCategories();
    }
};

window.collapseAllCategories = function () {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.collapseAllCategories();
    }
};

// Global logout function
window.logout = function () {
    const dashboard = window.adminDashboard;
    if (dashboard) {
        dashboard.logout();
    }
};

// Global user menu toggle function
window.toggleUserMenu = function () {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

// Global edit profile function
window.editProfile = function () {
    window.location.href = '/edit-profile.html';
};

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('userDropdown');
    const userProfile = document.querySelector('.user-profile');

    if (dropdown && userProfile && !userProfile.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
