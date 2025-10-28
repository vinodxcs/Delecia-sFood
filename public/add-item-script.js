// Add Item functionality
class AddItemManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.selectedFile = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        // Add a small delay to ensure DOM is fully loaded
        setTimeout(() => {
            console.log('Starting category loading...');
            this.loadCategories();
        }, 100);
    }

    checkAuth() {
        if (!this.token) {
            window.location.href = '/';
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') {
            window.location.href = '/';
            return;
        }

        this.currentUser = user;
    }

    setupEventListeners() {
        // Image upload
        const uploadArea = document.getElementById('image-upload-area');
        const fileInput = document.getElementById('item-image');
        const removeImageBtn = document.getElementById('remove-image');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ff6b6b';
            uploadArea.style.background = '#fff5f5';
        });
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.background = '#f8f9fa';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.background = '#f8f9fa';

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        removeImageBtn.addEventListener('click', () => {
            this.removeImage();
        });

        // Form submission
        document.getElementById('add-item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Cancel button
        document.querySelector('.btn-cancel').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
                window.location.href = 'admin-dashboard.html';
            }
        });
    }

    handleFileSelect(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showMessage('File size must be less than 10MB.', 'error');
            return;
        }

        this.selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            const uploadArea = document.getElementById('image-upload-area');

            previewImg.src = e.target.result;
            preview.style.display = 'block';
            uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removeImage() {
        this.selectedFile = null;
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('image-upload-area').style.display = 'block';
        document.getElementById('item-image').value = '';
    }

    async loadCategories() {
        console.log('Loading categories...');
        console.log('Using token:', this.token ? 'Present' : 'Missing');

        try {
            const response = await fetch('/api/admin/categories', {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Categories response status:', response.status);
            console.log('Categories response ok:', response.ok);

            if (response.ok) {
                const categories = await response.json();
                console.log('Categories loaded successfully:', categories);
                console.log('Number of categories:', categories.length);

                if (categories && categories.length > 0) {
                    this.categories = categories;
                    this.populateCategoryDropdown(categories);
                    this.showMessage(`Loaded ${categories.length} categories successfully`, 'success');
                } else {
                    console.log('No categories returned from API');
                    this.createFallbackCategories();
                }
            } else {
                const errorText = await response.text();
                console.error('Failed to load categories:', response.status, errorText);
                this.showMessage(`Failed to load categories: ${response.status}`, 'error');
                this.createFallbackCategories();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showMessage('Error loading categories. Please check your connection.', 'error');
            this.createFallbackCategories();
        }
    }

    createFallbackCategories() {
        console.log('No categories found in database. Showing create categories message...');

        // Only show fallback if we truly have no categories
        if (this.categories && this.categories.length > 0) {
            console.log('Categories exist, not showing fallback');
            return;
        }

        // Show message to create categories
        this.showMessage('No categories found. Please create categories first or use the sample data button.', 'warning');

        // Show create categories button
        this.showCreateCategoriesButton();

        // Set empty categories
        this.categories = [];
        this.populateCategoryDropdown([]);
    }

    showCreateCategoriesButton() {
        // Find the category selection container
        const container = document.querySelector('.category-selection-container');
        if (!container) return;

        // Create button to create sample categories
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
            text-align: center;
        `;

        buttonContainer.innerHTML = `
            <p style="margin: 0 0 10px 0; color: #856404;">
                <i class="fas fa-exclamation-triangle"></i>
                No categories found in database!
            </p>
            <button onclick="createSampleCategories()" 
                    style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-plus"></i> Create Sample Categories
            </button>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #6c757d;">
                This will create sample categories in your database
            </p>
        `;

        container.appendChild(buttonContainer);
    }

    populateCategoryDropdown(categories) {
        this.categories = categories;
        this.setupCascadingDropdowns();
    }

    setupCascadingDropdowns() {
        console.log('Setting up cascading dropdowns with categories:', this.categories);

        // Check if all required DOM elements exist
        const requiredElements = [];
        for (let level = 1; level <= 5; level++) {
            const select = document.getElementById(`category-level-${level}`);
            if (!select) {
                console.error(`Required element category-level-${level} not found`);
                return;
            }
            requiredElements.push(select);
        }

        console.log('All required elements found, proceeding with setup');

        // Populate level 1 (main categories)
        const mainCategories = this.categories.filter(cat => !cat.parent_id);
        console.log('Main categories found:', mainCategories);
        this.populateLevel(1, mainCategories);

        // Setup event listeners for cascading
        for (let level = 1; level <= 5; level++) {
            const select = document.getElementById(`category-level-${level}`);
            if (select) {
                console.log(`Setting up event listener for level ${level}`);
                select.addEventListener('change', (e) => {
                    console.log(`Level ${level} changed to:`, e.target.value);
                    this.handleCategoryChange(level, e.target.value);
                });
            } else {
                console.warn(`Select element for level ${level} not found`);
            }
        }
    }

    populateLevel(level, categories) {
        const select = document.getElementById(`category-level-${level}`);
        console.log(`Populating level ${level} with categories:`, categories);
        console.log(`Select element found:`, select);

        if (!select) {
            console.error(`Select element for level ${level} not found`);
            return;
        }

        // Clear existing options except the first one
        select.innerHTML = level === 1
            ? '<option value="">Select Main Category</option>'
            : `<option value="">Select ${this.getLevelName(level)} (Optional)</option>`;

        // Add category options with proper hierarchy
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;

            // Add visual hierarchy with indentation
            const indent = '  '.repeat(level - 1);
            option.textContent = indent + category.name;

            // Add data attributes for category tracking
            option.dataset.level = level;
            option.dataset.parentId = category.parent_id || '';

            select.appendChild(option);
        });

        console.log(`Level ${level} populated with ${categories.length} categories`);
    }

    getLevelName(level) {
        const names = {
            1: 'Main Category',
            2: 'Subcategory',
            3: 'Sub-subcategory',
            4: 'Sub-sub-subcategory',
            5: 'Sub-sub-sub-subcategory'
        };
        return names[level] || `Level ${level}`;
    }

    handleCategoryChange(level, selectedCategoryId) {
        console.log(`Category change: level ${level}, selected: ${selectedCategoryId}`);

        // Hide all levels after the current one
        for (let i = level + 1; i <= 5; i++) {
            this.hideLevel(i);
        }

        // Clear selections for hidden levels
        for (let i = level + 1; i <= 5; i++) {
            const select = document.getElementById(`category-level-${i}`);
            if (select) {
                select.value = '';
            }
        }

        if (selectedCategoryId) {
            // Find subcategories of the selected category
            const subcategories = this.categories.filter(cat => cat.parent_id === selectedCategoryId);
            console.log(`Found ${subcategories.length} subcategories for category ${selectedCategoryId}`);

            if (subcategories.length > 0 && level < 5) {
                console.log(`Showing level ${level + 1} with subcategories:`, subcategories);
                this.showLevel(level + 1);
                this.populateLevel(level + 1, subcategories);
            } else {
                console.log(`No subcategories found for category ${selectedCategoryId}`);
            }
        } else {
            console.log('No category selected, hiding all subsequent levels');
        }

        // Update category path display
        this.updateCategoryPath();
    }

    showLevel(level) {
        const container = document.getElementById(`category-level-${level}-container`);
        const select = document.getElementById(`category-level-${level}`);

        if (container && select) {
            container.style.display = 'block';
            container.classList.add('show');
        }
    }

    hideLevel(level) {
        const container = document.getElementById(`category-level-${level}-container`);
        if (container) {
            container.style.display = 'none';
            container.classList.remove('show');
        }
    }

    updateCategoryPath() {
        const pathDisplay = document.getElementById('category-path-display');
        const pathContainer = document.getElementById('selected-category-path');

        if (!pathDisplay || !pathContainer) return;

        const selectedPath = [];
        let currentLevel = 1;

        // Build path from selected categories
        while (currentLevel <= 5) {
            const select = document.getElementById(`category-level-${currentLevel}`);
            if (select && select.value) {
                const category = this.categories.find(cat => cat.id === select.value);
                if (category) {
                    selectedPath.push(category.name);
                }
            }
            currentLevel++;
        }

        if (selectedPath.length > 0) {
            pathDisplay.textContent = selectedPath.join(' → ');
            pathContainer.style.display = 'block';
        } else {
            pathContainer.style.display = 'none';
        }
    }

    getSelectedCategoryId() {
        // Return the deepest selected category (the most specific one)
        for (let level = 5; level >= 1; level--) {
            const select = document.getElementById(`category-level-${level}`);
            if (select && select.value) {
                console.log(`Selected category at level ${level}: ${select.value}`);
                return select.value;
            }
        }
        console.log('No category selected');
        return null;
    }

    getSelectedCategoryPath() {
        // Build the complete category path
        const path = [];
        for (let level = 1; level <= 5; level++) {
            const select = document.getElementById(`category-level-${level}`);
            if (select && select.value) {
                const category = this.categories.find(cat => cat.id === select.value);
                if (category) {
                    path.push(category.name);
                }
            }
        }
        return path.join(' → ');
    }

    async loadSubcategories(categoryId) {
        if (!categoryId) {
            document.getElementById('item-subcategory').innerHTML = '<option value="">Select Subcategory (Optional)</option>';
            return;
        }

        try {
            const response = await fetch(`/api/admin/subcategories?category_id=${categoryId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const subcategories = await response.json();
                const subcategorySelect = document.getElementById('item-subcategory');

                subcategorySelect.innerHTML = '<option value="">Select Subcategory (Optional)</option>';
                subcategories.forEach(subcategory => {
                    const option = document.createElement('option');
                    option.value = subcategory.id;
                    option.textContent = subcategory.name;
                    subcategorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading subcategories:', error);
        }
    }

    async handleSubmit() {
        const formData = new FormData();

        // Get form data
        const selectedCategoryId = this.getSelectedCategoryId();
        const selectedCategoryPath = this.getSelectedCategoryPath();

        console.log('Form submission data:');
        console.log('- Selected Category ID:', selectedCategoryId);
        console.log('- Selected Category Path:', selectedCategoryPath);

        const itemData = {
            name: document.getElementById('item-name').value,
            description: document.getElementById('item-description').value,
            price: parseFloat(document.getElementById('item-price').value),
            category_id: selectedCategoryId,
            stock: parseInt(document.getElementById('item-stock').value)
        };

        console.log('Item data to submit:', itemData);

        // Validate required fields
        if (!itemData.name || !itemData.price || !itemData.category_id || itemData.stock < 0) {
            this.showMessage('Please fill in all required fields and select a category.', 'error');
            return;
        }

        try {
            this.showLoading(true);

            // Upload image first if selected
            let imageUrl = null;
            if (this.selectedFile) {
                console.log('Uploading image...');
                imageUrl = await this.uploadImage();
                console.log('Image uploaded successfully:', imageUrl);
            }

            // Create item
            const response = await fetch('/api/admin/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    ...itemData,
                    image_url: imageUrl
                })
            });

            if (response.ok) {
                this.showMessage('Item created successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'admin-dashboard.html';
                }, 1500);
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to create item', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async uploadImage() {
        if (!this.selectedFile) return null;

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Upload successful:', result);
                return result.url;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    showLoading(show) {
        const form = document.getElementById('add-item-form');
        const submitBtn = document.querySelector('.btn-submit');

        if (show) {
            form.classList.add('loading');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
        } else {
            form.classList.remove('loading');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'error' ? 'error-message' : 'success-message'}`;
        messageDiv.textContent = message;

        // Insert message at the top of the form
        const form = document.getElementById('add-item-form');
        form.insertBefore(messageDiv, form.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Global function to create sample categories
window.createSampleCategories = async function () {
    try {
        const response = await fetch('/api/admin/create-sample-categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            alert('Sample categories created successfully! Please refresh the page to see them.');
            window.location.reload();
        } else {
            alert('Error creating categories: ' + result.error);
        }
    } catch (error) {
        console.error('Error creating sample categories:', error);
        alert('Network error. Please try again.');
    }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AddItemManager();
});
