# 🍕 Delicia's Food Management System

## 📋 Project Overview
A complete food management system with hierarchical categories, product management, and admin dashboard.

## 🏗️ Project Structure
```
Delicia's Food/
├── config/
│   └── supabase.js          # Supabase configuration
├── public/
│   ├── index.html           # Main landing page
│   ├── admin-dashboard.html # Admin dashboard
│   ├── add-item.html        # Add item form
│   ├── styles.css           # Main styles
│   ├── admin-styles.css     # Admin dashboard styles
│   ├── add-item-styles.css  # Add item form styles
│   ├── script.js            # Main JavaScript
│   ├── admin-script.js      # Admin dashboard JavaScript
│   └── add-item-script.js   # Add item form JavaScript
├── routes/
│   ├── admin.js             # Admin API routes
│   ├── auth.js              # Authentication routes
│   └── user.js              # User API routes
├── server.js                # Main server file
├── database-schema.sql      # Database schema
├── env.example              # Environment variables template
└── package.json             # Project dependencies
```

## 🚀 Features
- ✅ **Authentication System** (Admin & User)
- ✅ **Hierarchical Categories** (Unlimited nesting levels)
- ✅ **Product Management** with images
- ✅ **Admin Dashboard** with category/product management
- ✅ **Image Upload** with Supabase Storage
- ✅ **Responsive Design**

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Frontend**: HTML, CSS, JavaScript
- **Authentication**: JWT tokens

## 📦 Installation
1. Install dependencies: `npm install`
2. Copy `env.example` to `.env` and configure
3. Run database schema: `database-schema.sql`
4. Start server: `node server.js`

## 🔧 Configuration
- Supabase URL and API key in `.env`
- JWT secret for authentication
- Database tables: users, categories, items, orders

## 📱 Usage
- **Admin**: Manage categories, products, view orders
- **Users**: Browse products, place orders
- **Categories**: Hierarchical structure (Fruit → Apple → Red Apple)
- **Products**: Upload images, set prices, manage inventory

## 🎯 Key Files
- `server.js` - Main server entry point
- `routes/admin.js` - Admin API endpoints
- `public/admin-dashboard.html` - Admin interface
- `public/add-item.html` - Product creation form
- `database-schema.sql` - Database structure

## ✨ Recent Updates
- Fixed Supabase storage bucket configuration
- Implemented hierarchical category system
- Enhanced image upload with public/signed URLs
- Improved admin dashboard with category navigation
- Added cascading dropdowns for category selection

