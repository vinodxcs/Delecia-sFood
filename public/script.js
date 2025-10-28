// Authentication functionality
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.selectedProfileImage = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Registration form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Profile image upload
        const profileImageInput = document.getElementById('profileImageInput');
        if (profileImageInput) {
            profileImageInput.addEventListener('change', (e) => {
                this.handleProfileImageSelect(e.target.files[0]);
            });
        }
    }

    handleProfileImageSelect(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('File size must be less than 5MB.', 'error');
            return;
        }

        this.selectedProfileImage = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('photoPreview');
            const previewImg = document.getElementById('previewImage');
            const uploadArea = document.getElementById('photoUpload');

            previewImg.src = e.target.result;
            preview.style.display = 'block';
            uploadArea.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removeProfilePhoto() {
        this.selectedProfileImage = null;
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('photoUpload').style.display = 'block';
        document.getElementById('profileImageInput').value = '';
    }

    async handleRegister() {
        const userData = {
            fullName: document.getElementById('regFullName').value,
            email: document.getElementById('regEmail').value,
            mobileNumber: document.getElementById('regMobile').value,
            password: document.getElementById('regPassword').value,
            role: document.getElementById('regRole').value
        };


        try {
            this.showLoading(true);

            // Upload profile image first if selected
            let profileImageUrl = null;
            if (this.selectedProfileImage) {
                console.log('Uploading profile image...');
                profileImageUrl = await this.uploadProfileImage();
                console.log('Profile image uploaded successfully:', profileImageUrl);
            }

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...userData,
                    profileImageUrl
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Registration successful! Please login.', 'success');
                document.getElementById('registerForm').reset();
                this.removeProfilePhoto();
            } else {
                this.showMessage(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async uploadProfileImage() {
        if (!this.selectedProfileImage) return null;

        try {
            const formData = new FormData();
            formData.append('file', this.selectedProfileImage);

            const response = await fetch('/api/auth/upload-profile-image', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Profile image upload successful:', result);
                return result.url;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Profile image upload failed');
            }
        } catch (error) {
            console.error('Error uploading profile image:', error);
            throw error;
        }
    }

    async handleLogin() {
        const userData = {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value,
            role: document.getElementById('loginRole').value
        };


        try {
            this.showLoading(true);
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                this.token = result.token;
                this.currentUser = result.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.currentUser));

                this.showMessage('Login successful! Redirecting...', 'success');

                // Redirect based on role
                setTimeout(() => {
                    if (result.user.role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else {
                        window.location.href = '/user/home.html';
                    }
                }, 1500);
            } else {
                this.showMessage(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    checkAuthStatus() {
        if (this.token) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'admin') {
                window.location.href = '/admin-dashboard.html';
            } else if (user.role === 'user') {
                window.location.href = '/user/home.html';
            }
        }
    }

    showLoading(show) {
        const buttons = document.querySelectorAll('.auth-button');
        buttons.forEach(button => {
            button.disabled = show;
            button.textContent = show ? 'Loading...' : (button.textContent.includes('Register') ? 'Register' : 'Login');
        });
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.error-message, .success-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.textContent = message;

        // Insert message at the top of the form
        const forms = document.querySelectorAll('.auth-form');
        forms.forEach(form => {
            form.insertBefore(messageDiv, form.firstChild);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Global function for removing profile photo
window.removeProfilePhoto = function () {
    const authManager = window.authManager;
    if (authManager) {
        authManager.removeProfilePhoto();
    }
};

// Initialize authentication manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
