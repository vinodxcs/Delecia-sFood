const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin role required.' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

// Public routes (no authentication required)
// Get public categories for user browsing
router.get('/public-categories', async (req, res) => {
    try {
        console.log('Fetching public categories...');
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Public categories error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Public categories fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Public categories catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get public items for user browsing
router.get('/public-items', async (req, res) => {
    try {
        const { category_id } = req.query;
        console.log('Fetching public items, category_id:', category_id);

        let query = supabaseAdmin
            .from('items')
            .select(`
                *,
                categories:category_id (
                    id,
                    name,
                    parent_id
                )
            `)
            .order('created_at', { ascending: false });

        // Filter by category if specified
        if (category_id && category_id !== 'all') {
            query = query.eq('category_id', category_id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Public items error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Public items fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Public items catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get category hierarchy for user browsing
router.get('/public-category-tree', async (req, res) => {
    try {
        console.log('Fetching public category tree...');
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Public category tree error:', error);
            return res.status(400).json({ error: error.message });
        }

        // Build hierarchical structure
        const categoryTree = buildCategoryTree(data || []);
        console.log('Public category tree built:', categoryTree.length, 'root categories');
        res.json(categoryTree);
    } catch (error) {
        console.error('Public category tree catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to build category tree
function buildCategoryTree(categories) {
    const categoryMap = new Map();
    const rootCategories = [];

    // Create map of all categories
    categories.forEach(category => {
        categoryMap.set(category.id, { ...category, children: [] });
    });

    // Build tree structure
    categories.forEach(category => {
        if (category.parent_id) {
            const parent = categoryMap.get(category.parent_id);
            if (parent) {
                parent.children.push(categoryMap.get(category.id));
            }
        } else {
            rootCategories.push(categoryMap.get(category.id));
        }
    });

    return rootCategories;
}

// Apply admin middleware to all remaining routes
router.use(verifyAdminToken);

// Get dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        // Get counts for dashboard
        const [categoriesResult, itemsResult, ordersResult] = await Promise.all([
            supabaseAdmin.from('categories').select('*', { count: 'exact' }),
            supabaseAdmin.from('items').select('*', { count: 'exact' }),
            supabaseAdmin.from('orders').select('*', { count: 'exact' })
        ]);

        res.json({
            categories: categoriesResult.count || 0,
            items: itemsResult.count || 0,
            orders: ordersResult.count || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Categories management
router.get('/categories', async (req, res) => {
    try {
        console.log('Fetching categories...');
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Categories error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Categories fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Categories catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, parent_id } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const { data, error } = await supabaseAdmin
            .from('categories')
            .insert([{ name, parent_id: parent_id || null }])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;

        const { data, error } = await supabaseAdmin
            .from('categories')
            .update({ name, parent_id: parent_id || null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Subcategories management
router.get('/subcategories', async (req, res) => {
    try {
        const { category_id } = req.query;
        let query = supabaseAdmin.from('subcategories').select('*');

        if (category_id) {
            query = query.eq('category_id', category_id);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Items management
router.get('/items', async (req, res) => {
    try {
        console.log('Fetching items...');
        const { data, error } = await supabaseAdmin
            .from('items')
            .select(`
                *,
                categories(name),
                subcategories(name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Items error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Items fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Items catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/items', async (req, res) => {
    try {
        const { name, description, price, image_url, category_id, stock } = req.body;

        if (!name || !price || !category_id) {
            return res.status(400).json({ error: 'Name, price, and category are required' });
        }

        console.log('Creating item with data:', { name, description, price, image_url, category_id, stock });

        const { data, error } = await supabaseAdmin
            .from('items')
            .insert([{
                name,
                description,
                price,
                image_url,
                category_id, // This is the deepest selected category from cascading dropdowns
                stock: stock || 0
            }])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, image_url, category_id, subcategory_id, stock, status } = req.body;

        const { data, error } = await supabaseAdmin
            .from('items')
            .update({
                name,
                description,
                price,
                image_url,
                category_id,
                subcategory_id,
                stock,
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('items')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Image upload endpoint
router.post('/upload', async (req, res) => {
    try {
        const multer = require('multer');
        const upload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
                const filename = `${timestamp}-${req.file.originalname}`;
                const filePath = filename;

                // Upload to Supabase Storage
                const { data, error } = await supabaseAdmin.storage
                    .from('food-images')
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (error) {
                    console.error('Storage upload error:', error);

                    // If bucket doesn't exist, try to create it
                    if (error.message.includes('Bucket not found') || error.message.includes('bucket')) {
                        console.log('Attempting to create bucket...');

                        // Try to create the bucket
                        const { data: bucketData, error: bucketError } = await supabaseAdmin.storage
                            .createBucket('food-images', {
                                public: true,
                                fileSizeLimit: 10485760 // 10MB
                            });

                        if (bucketError) {
                            console.error('Failed to create bucket:', bucketError);
                            return res.status(400).json({
                                error: 'Storage bucket not found and could not be created: ' + bucketError.message
                            });
                        }

                        console.log('Bucket created successfully, retrying upload...');

                        // Retry upload after creating bucket
                        const { data: retryData, error: retryError } = await supabaseAdmin.storage
                            .from('food-images')
                            .upload(filePath, req.file.buffer, {
                                contentType: req.file.mimetype,
                                upsert: false
                            });

                        if (retryError) {
                            return res.status(400).json({ error: 'Storage upload failed after bucket creation: ' + retryError.message });
                        }

                        // Continue with successful upload
                        console.log('Upload successful after bucket creation');
                    } else {
                        return res.status(400).json({ error: 'Storage upload failed: ' + error.message });
                    }
                }

                // Get public URL (should work if bucket is public)
                const { data: urlData } = supabaseAdmin.storage
                    .from('food-images')
                    .getPublicUrl(filePath);

                console.log('Public URL generated:', urlData.publicUrl);

                // Also create a signed URL as backup (1 year expiry)
                const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
                    .from('food-images')
                    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

                console.log('Signed URL generated:', signedUrlData ? signedUrlData.signedUrl : 'Failed');

                // Use signed URL as primary since it works reliably
                const finalUrl = signedUrlData.signedUrl || urlData.publicUrl;

                if (!finalUrl) {
                    return res.status(400).json({ error: 'Failed to generate image URL' });
                }

                console.log('Final URL to return:', finalUrl);

                res.json({
                    url: finalUrl,
                    path: filePath,
                    publicUrl: urlData.publicUrl,
                    signedUrl: signedUrlData ? signedUrlData.signedUrl : null,
                    bucket: 'food-images',
                    isPublic: !!urlData.publicUrl,
                    urlType: signedUrlData ? 'signed' : 'public'
                });
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
            }
        });
    } catch (error) {
        console.error('Upload endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public categories endpoint (no auth required)
router.get('/public-categories', async (req, res) => {
    try {
        console.log('Fetching public categories...');
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Public categories error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Public categories fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Public categories catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public items endpoint (no auth required)
router.get('/public-items', async (req, res) => {
    try {
        console.log('Fetching public items...');
        const { data, error } = await supabaseAdmin
            .from('items')
            .select(`
                *,
                categories(name),
                subcategories(name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Public items error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('Public items fetched:', data?.length || 0);
        res.json(data || []);
    } catch (error) {
        console.error('Public items catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Public test endpoint (for debugging only)
router.get('/test-items', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('items')
            .select(`
                *,
                categories(name),
                subcategories(name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint to check server status
router.get('/test', (req, res) => {
    res.json({
        status: 'Server is running',
        timestamp: new Date().toISOString(),
        message: 'Admin API is working'
    });
});

// Create sample categories endpoint
router.post('/create-sample-categories', async (req, res) => {
    try {
        console.log('Creating sample categories...');

        // First, check if categories already exist
        const { data: existingCategories, error: checkError } = await supabaseAdmin
            .from('categories')
            .select('id, name')
            .limit(1);

        if (checkError) {
            return res.status(400).json({ error: 'Failed to check existing categories: ' + checkError.message });
        }

        if (existingCategories && existingCategories.length > 0) {
            return res.json({
                message: 'Categories already exist in database',
                existing_count: existingCategories.length,
                suggestion: 'Use existing categories or clear database first'
            });
        }

        // Create sample categories with proper UUIDs
        const sampleCategories = [
            {
                id: '550e8400-e29b-41d4-a716-446655440001',
                name: 'Fruits',
                parent_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440002',
                name: 'Vegetables',
                parent_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440003',
                name: 'Dairy',
                parent_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440004',
                name: 'Bakery',
                parent_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440005',
                name: 'Apples',
                parent_id: '550e8400-e29b-41d4-a716-446655440001',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440006',
                name: 'Bananas',
                parent_id: '550e8400-e29b-41d4-a716-446655440001',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440007',
                name: 'Red Apples',
                parent_id: '550e8400-e29b-41d4-a716-446655440005',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440008',
                name: 'Green Apples',
                parent_id: '550e8400-e29b-41d4-a716-446655440005',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];

        const { data: categories, error: catError } = await supabaseAdmin
            .from('categories')
            .insert(sampleCategories)
            .select();

        if (catError) {
            console.error('Failed to create categories:', catError);
            return res.status(400).json({ error: 'Failed to create categories: ' + catError.message });
        }

        console.log('Sample categories created successfully:', categories.length);
        res.json({
            message: 'Sample categories created successfully',
            categories_created: categories.length,
            categories: categories
        });
    } catch (error) {
        console.error('Error creating sample categories:', error);
        res.status(500).json({
            error: 'Failed to create sample categories: ' + error.message
        });
    }
});

// Test endpoint to check database connection
router.get('/test-db', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('count', { count: 'exact' });

        if (error) {
            return res.status(400).json({
                status: 'Database connection failed',
                error: error.message
            });
        }

        res.json({
            status: 'Database connected',
            categories_count: data?.length || 0,
            message: 'Supabase connection is working'
        });
    } catch (error) {
        res.status(500).json({
            status: 'Database connection error',
            error: error.message
        });
    }
});

// Create sample data for testing
router.post('/create-sample-data', async (req, res) => {
    try {
        // Create sample categories with nested structure
        const sampleCategories = [
            { name: 'Fruits', parent_id: null },
            { name: 'Vegetables', parent_id: null },
            { name: 'Dairy', parent_id: null },
            { name: 'Bakery', parent_id: null }
        ];

        const { data: categories, error: catError } = await supabaseAdmin
            .from('categories')
            .insert(sampleCategories)
            .select();

        if (catError) {
            return res.status(400).json({ error: 'Failed to create categories: ' + catError.message });
        }

        // Create subcategories
        const fruitId = categories.find(c => c.name === 'Fruits')?.id;
        const vegetableId = categories.find(c => c.name === 'Vegetables')?.id;

        if (fruitId) {
            const fruitSubcategories = [
                { name: 'Apples', parent_id: fruitId },
                { name: 'Citrus', parent_id: fruitId },
                { name: 'Berries', parent_id: fruitId }
            ];

            const { data: fruitSubs, error: fruitSubError } = await supabaseAdmin
                .from('categories')
                .insert(fruitSubcategories)
                .select();

            if (!fruitSubError && fruitSubs) {
                // Create sub-subcategories for Apples
                const appleId = fruitSubs.find(s => s.name === 'Apples')?.id;
                if (appleId) {
                    const appleSubSubcategories = [
                        { name: 'Red Apples', parent_id: appleId },
                        { name: 'Green Apples', parent_id: appleId },
                        { name: 'Golden Apples', parent_id: appleId }
                    ];

                    await supabaseAdmin
                        .from('categories')
                        .insert(appleSubSubcategories);
                }
            }
        }

        if (vegetableId) {
            const vegetableSubcategories = [
                { name: 'Leafy Greens', parent_id: vegetableId },
                { name: 'Root Vegetables', parent_id: vegetableId }
            ];

            await supabaseAdmin
                .from('categories')
                .insert(vegetableSubcategories);
        }

        res.json({
            message: 'Sample data created successfully',
            categories_created: categories.length,
            structure: 'Fruits -> Apples -> Red/Green/Golden Apples, etc.'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create sample data: ' + error.message
        });
    }
});

module.exports = router;
