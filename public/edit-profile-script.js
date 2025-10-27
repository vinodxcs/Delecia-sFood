// Edit Profile functionality
class EditProfileManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.selectedProfileImage = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserProfile();
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
        // Profile image upload
        const profileImageInput = document.getElementById('profileImageInput');
        if (profileImageInput) {
            profileImageInput.addEventListener('change', (e) => {
                this.handleProfileImageSelect(e.target.files[0]);
            });
        }

        // Form submission
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileUpdate();
            });
        }
    }

    loadUserProfile() {
        if (this.currentUser) {
            // Populate form fields
            document.getElementById('fullName').value = this.currentUser.name || '';
            document.getElementById('email').value = this.currentUser.email || '';
            document.getElementById('mobileNumber').value = this.currentUser.mobile_number || '';
            document.getElementById('role').value = this.currentUser.role || 'user';

            // Set current profile image
            const currentPhoto = document.getElementById('currentPhoto');
            if (this.currentUser.profile_image_url) {
                currentPhoto.src = this.currentUser.profile_image_url;
            } else {
                currentPhoto.src = 'https://via.placeholder.com/120';
            }
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
            const uploadArea = document.getElementById('photoUploadArea');
            const currentPhoto = document.getElementById('currentPhoto');

            previewImg.src = e.target.result;
            preview.style.display = 'block';
            uploadArea.style.display = 'none';
            currentPhoto.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removeNewPhoto() {
        this.selectedProfileImage = null;
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('photoUploadArea').style.display = 'inline-block';
        document.getElementById('currentPhoto').style.display = 'block';
        document.getElementById('profileImageInput').value = '';
    }

    async handleProfileUpdate() {
        const formData = {
            name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            mobile_number: document.getElementById('mobileNumber').value
        };

        // Validate required fields
        if (!formData.name || !formData.email || !formData.mobile_number) {
            this.showMessage('Please fill in all required fields.', 'error');
            return;
        }

        try {
            this.showLoading(true);

            // Upload new profile image first if selected
            let profileImageUrl = this.currentUser.profile_image_url;
            if (this.selectedProfileImage) {
                console.log('Uploading new profile image...');
                profileImageUrl = await this.uploadProfileImage();
                console.log('Profile image uploaded successfully:', profileImageUrl);
            }

            // Update user profile
            const response = await fetch('/api/auth/update-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    ...formData,
                    profile_image_url: profileImageUrl
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Update local storage
                const updatedUser = { ...this.currentUser, ...formData, profile_image_url: profileImageUrl };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                this.currentUser = updatedUser;

                this.showMessage('Profile updated successfully!', 'success');

                // Update the current photo display
                const currentPhoto = document.getElementById('currentPhoto');
                currentPhoto.src = profileImageUrl || 'https://via.placeholder.com/120';

                // Reset form state
                this.removeNewPhoto();

                // Redirect back to dashboard after a short delay
                setTimeout(() => {
                    window.location.href = 'admin-dashboard.html';
                }, 2000);
            } else {
                this.showMessage(result.error || 'Failed to update profile', 'error');
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

    showLoading(show) {
        const form = document.getElementById('editProfileForm');
        const submitBtn = document.querySelector('.btn-primary');

        if (show) {
            form.classList.add('loading');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
        } else {
            form.classList.remove('loading');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Profile';
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
        const form = document.getElementById('editProfileForm');
        form.insertBefore(messageDiv, form.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Global function for removing new photo
window.removeNewPhoto = function () {
    const editProfileManager = window.editProfileManager;
    if (editProfileManager) {
        editProfileManager.removeNewPhoto();
    }
};

// Initialize edit profile manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.editProfileManager = new EditProfileManager();
});
