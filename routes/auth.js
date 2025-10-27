const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, mobileNumber, role = 'user', profileImageUrl } = req.body;

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        // Insert user data into users table
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    name: fullName,
                    email: email,
                    mobile_number: mobileNumber,
                    role: role,
                    profile_image_url: profileImageUrl || null
                }
            ])
            .select();

        if (userError) {
            return res.status(400).json({ error: userError.message });
        }

        // Generate JWT token (expires in 30 days)
        const token = jwt.sign(
            { userId: authData.user.id, role: role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Registration successful',
            user: userData[0],
            token
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password, role = 'user' } = req.body;

        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        // Get user data from database
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check role if specified
        if (role && userData.role !== role) {
            return res.status(403).json({ error: 'Invalid role access' });
        }

        // Generate JWT token (expires in 30 days)
        const token = jwt.sign(
            { userId: authData.user.id, role: userData.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login successful',
            user: userData,
            token
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: 'Logout successful' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload profile image
router.post('/upload-profile-image', async (req, res) => {
    try {
        const multer = require('multer');
        const upload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
        }).single('file');

        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: 'File upload error: ' + err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                // Generate unique filename
                const timestamp = Date.now();
                const filename = `profile-${timestamp}-${req.file.originalname}`;
                const filePath = filename;

                // Upload to Supabase Storage
                const { data, error } = await supabaseAdmin.storage
                    .from('profile-images')
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (error) {
                    console.error('Storage upload error:', error);

                    // If bucket doesn't exist, try to create it
                    if (error.message.includes('Bucket not found') || error.message.includes('bucket')) {
                        console.log('Attempting to create profile-images bucket...');

                        // Try to create the bucket
                        const { data: bucketData, error: bucketError } = await supabaseAdmin.storage
                            .createBucket('profile-images', {
                                public: true,
                                fileSizeLimit: 5242880 // 5MB
                            });

                        if (bucketError) {
                            console.error('Failed to create bucket:', bucketError);
                            return res.status(400).json({
                                error: 'Storage bucket not found and could not be created: ' + bucketError.message
                            });
                        }

                        console.log('Profile-images bucket created successfully, retrying upload...');

                        // Retry upload after creating bucket
                        const { data: retryData, error: retryError } = await supabaseAdmin.storage
                            .from('profile-images')
                            .upload(filePath, req.file.buffer, {
                                contentType: req.file.mimetype,
                                upsert: false
                            });

                        if (retryError) {
                            return res.status(400).json({ error: 'Storage upload failed after bucket creation: ' + retryError.message });
                        }

                        console.log('Profile image upload successful after bucket creation');
                    } else {
                        return res.status(400).json({ error: 'Storage upload failed: ' + error.message });
                    }
                }

                // Get public URL
                const { data: urlData } = supabaseAdmin.storage
                    .from('profile-images')
                    .getPublicUrl(filePath);

                console.log('Profile image public URL generated:', urlData.publicUrl);

                // Also create a signed URL as backup (1 year expiry)
                const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
                    .from('profile-images')
                    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

                console.log('Profile image signed URL generated:', signedUrlData ? signedUrlData.signedUrl : 'Failed');

                // Use signed URL as primary since it works reliably
                const finalUrl = signedUrlData.signedUrl || urlData.publicUrl;

                if (!finalUrl) {
                    return res.status(400).json({ error: 'Failed to generate image URL' });
                }

                console.log('Final profile image URL to return:', finalUrl);

                res.json({
                    url: finalUrl,
                    path: filePath,
                    publicUrl: urlData.publicUrl,
                    signedUrl: signedUrlData ? signedUrlData.signedUrl : null,
                    bucket: 'profile-images',
                    isPublic: !!urlData.publicUrl,
                    urlType: signedUrlData ? 'signed' : 'public'
                });
            } catch (uploadError) {
                console.error('Profile image upload error:', uploadError);
                res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
            }
        });
    } catch (error) {
        console.error('Profile image upload endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
router.put('/update-profile', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const { name, email, mobile_number, profile_image_url } = req.body;

        // Update user data in database
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .update({
                name,
                email,
                mobile_number,
                profile_image_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (userError) {
            return res.status(400).json({ error: userError.message });
        }

        res.json({
            message: 'Profile updated successfully',
            user: userData
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: 'Invalid token.' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
