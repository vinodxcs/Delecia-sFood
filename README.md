<<<<<<< HEAD
# Delicias Food - Food Management System

A comprehensive food management system with admin dashboard and user-facing e-commerce interface.

## Features

### Admin Features
- **Dashboard**: Overview of products, orders, and analytics
- **Product Management**: Add, edit, delete products with categories
- **Category Management**: Hierarchical category system with subcategories
- **Order Management**: View and manage customer orders
- **Profile Management**: Admin profile with photo upload

### User Features
- **Product Browsing**: Browse products by categories and subcategories
- **Shopping Cart**: Add items to cart with quantity management
- **User Authentication**: Registration and login with profile management
- **Order History**: View past orders and order status
- **Profile Management**: User profile with photo upload
- **Search & Filter**: Advanced product search and filtering

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **File Storage**: Supabase Storage
- **Payment**: Stripe integration
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Styling**: Custom CSS with responsive design

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/delicias-food.git
cd delicias-food
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Configure your `.env` file with:
- Supabase URL and API key
- JWT secret
- Stripe keys
- Server port

5. Run the application:
```bash
npm start
```

## Environment Variables

Create a `.env` file with the following variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
PORT=3000
```

## Database Setup

1. Create a Supabase project
2. Run the SQL scripts in the project root:
   - `database-schema.sql` - Main database schema
   - `database-migration-profile-images.sql` - Profile images support

3. Set up Supabase Storage bucket named `profile-images` as public

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `PUT /api/auth/update-profile` - Update user profile
- `POST /api/auth/upload-profile-image` - Upload profile image

### Admin
- `GET /api/admin/dashboard` - Dashboard data
- `GET /api/admin/items` - Get all items
- `POST /api/admin/items` - Add new item
- `PUT /api/admin/items/:id` - Update item
- `DELETE /api/admin/items/:id` - Delete item
- `GET /api/admin/categories` - Get categories
- `POST /api/admin/categories` - Add category
- `GET /api/admin/public-items` - Public items API
- `GET /api/admin/public-category-tree` - Public category tree

### User
- `GET /api/user/profile` - Get user profile
- `POST /api/user/orders` - Create order
- `GET /api/user/orders` - Get user orders

## Deployment

This application is deployed on Render. The deployment includes:
- Automatic builds from GitHub
- Environment variable configuration
- Static file serving
- Database connection to Supabase

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@deliciasfood.com or create an issue in the GitHub repository.
=======
# Delecia-sFood
This is for Food site 
>>>>>>> e9f2ca05ab3f08f75ecaff7d7d107aa201404e6f
