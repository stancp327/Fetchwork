# FetchWork

All-in-one freelance platform for remote and local services with comprehensive admin dashboard, secure payments, messaging, and AI support.

## 🚀 Recent Updates (January 2025)

**✅ Comprehensive AdminDashboard Restoration Completed (PR #7)**
- Restored full admin dashboard functionality from backup zip file
- Enhanced User model with firstName/lastName fields and advanced security (14-round bcrypt)
- Added complete admin system with user/job/payment/review management
- Implemented comprehensive frontend routing with protected routes
- Updated deployment configurations for Render backend
- All 30+ missing components restored while preserving JWT authentication

**✅ JWT Authentication System (PR #6)**
- Complete user registration and login system
- 7-day JWT token expiry with HS256 algorithm
- Rate limiting and security middleware
- Comprehensive API documentation

**✅ MongoDB Integration (PR #5)**
- Database connection verification endpoint
- Production-ready MongoDB Atlas integration

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Enhanced User Model**: firstName/lastName fields, 14-round bcrypt hashing, user management methods
- **Admin System**: Role-based access control, comprehensive dashboard endpoints  
- **Database Models**: User, Admin, Job, Payment, Review schemas with advanced validation
- **Authentication**: JWT-based auth with 7-day token expiry, rate limiting, security middleware
- **API Routes**: RESTful endpoints for auth, admin, user management

### Frontend (React)
- **Comprehensive Routing**: Protected routes, public routes, admin-only sections
- **AdminDashboard**: User management, job oversight, payment controls, platform statistics
- **Authentication Context**: Centralized auth state management with automatic token handling
- **Component Structure**: Modular design with Home, Auth, Dashboard, Jobs, Profile, Messages, etc.
- **Responsive Design**: Mobile-friendly admin dashboard with modern UI/UX

## 📁 Project Structure

```
FetchWork/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/         # AdminDashboard components
│   │   │   ├── Auth/          # Login/Register components
│   │   │   ├── Dashboard/     # User dashboard
│   │   │   ├── Jobs/          # Job browsing/posting
│   │   │   ├── Navigation/    # Site navigation
│   │   │   └── ...
│   │   ├── context/           # React contexts (Auth, Messaging)
│   │   └── App.js            # Main routing component
│   └── package.json
├── server/                     # Node.js backend
│   ├── models/                # Mongoose schemas
│   │   ├── User.js           # Enhanced user model
│   │   ├── Admin.js          # Admin user model
│   │   ├── Job.js            # Job posting model
│   │   ├── Payment.js        # Payment tracking
│   │   └── Review.js         # Review system
│   ├── routes/               # API routes
│   │   └── admin.js          # Admin dashboard routes
│   ├── middleware/           # Custom middleware
│   │   └── auth.js           # JWT authentication
│   ├── index.js              # Main server file
│   └── package.json
├── vercel.json                # Vercel deployment config
├── DEPLOYMENT.md              # Deployment instructions
└── README.md                  # This file
```

## Getting Started

### Prerequisites
- Node.js (v18.20.4 recommended)
- MongoDB

### 1. Install Dependencies

From the root of `client` and `server`, run:
```
npm install
```

### 2. Start Development Servers

From `client/`:
```
npm start
```

From `server/`:
```
node index.js
```

### 3. Environment Variables

#### Server (.env.local)
```bash
# MongoDB Configuration
MONGO_URI=mongodb+srv://Fetchwork_user:YOUR_PASSWORD@fetchwork.sch7kdf.mongodb.net/?retryWrites=true&w=majority&authSource=admin&appName=Fetchwork

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Server Configuration
PORT=10000
NODE_ENV=development
```

#### Client (.env.local)
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:10000

# Development Configuration
GENERATE_SOURCEMAP=false
```

## Authentication System

### JWT Specifications
- **Algorithm**: HS256 (HMAC SHA-256)
- **Token Expiry**: 7 days from issue
- **Password Hashing**: bcrypt with 12 salt rounds
- **Header Format**: `Authorization: Bearer {token}`
- **Secret**: Configured via `JWT_SECRET` environment variable

### Security Features
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Cross-origin resource sharing enabled
- **Helmet**: Security headers applied
- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Signing**: HS256 algorithm with secure secret

## 🎯 Key Features

### User Management
- **Registration**: Enhanced with firstName/lastName fields
- **Authentication**: JWT-based with 7-day token expiry
- **Security**: 14-round bcrypt hashing, rate limiting (100 req/15min)
- **Profile Management**: Comprehensive user profiles with skills, ratings, verification

### Admin Dashboard
- **User Oversight**: View, suspend, activate users
- **Job Management**: Monitor job postings, resolve disputes
- **Payment Controls**: Track payment volume, manage escrow
- **Platform Statistics**: Real-time metrics and activity monitoring
- **Review System**: Moderate reviews, manage ratings

### Frontend Features
- **Protected Routing**: Role-based access control
- **Responsive Design**: Mobile-friendly admin interface
- **Real-time Updates**: Dynamic dashboard data
- **Modern UI**: Clean, professional design with CSS animations

## 📡 API Endpoints

### Authentication Routes

#### POST /api/auth/register
Register a new user account with enhanced profile fields.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Validation:**
- Email, password, firstName, and lastName required
- Password minimum 6 characters
- Email must be unique

#### POST /api/auth/login
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

### Admin Dashboard Routes

#### GET /api/admin/dashboard
Get comprehensive admin dashboard data (requires admin token).

**Headers:**
```
Authorization: Bearer {admin_jwt_token}
```

**Response (200):**
```json
{
  "stats": {
    "totalUsers": 150,
    "totalJobs": 45,
    "totalPayments": 1250.50,
    "totalReviews": 89
  },
  "recentUsers": [...],
  "recentJobs": [...],
  "recentPayments": [...]
}
```

#### GET /api/admin/users
List all users with management options (admin only).

#### POST /api/admin/users/:id/suspend
Suspend a user account (admin only).

#### POST /api/admin/users/:id/activate
Activate a suspended user account (admin only).

### Utility Routes

#### GET /test-db
Check MongoDB connection status.

**Response:** `✅ MongoDB Connected!` or `❌ MongoDB Not Connected`

#### GET /health
Server health check endpoint.

### Using JWT Tokens

Include the JWT token in the Authorization header for protected routes:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Responses

All endpoints return consistent error format:
```json
{
  "error": "Error message description"
}
```

**Common Error Codes:**
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid credentials)
- **403**: Forbidden (invalid token)
- **500**: Internal Server Error

## Development

### Testing Authentication Locally

```bash
# Register new user with enhanced fields
curl -X POST http://localhost:10000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","firstName":"Test","lastName":"User"}'

# Login user
curl -X POST http://localhost:10000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Test database connection
curl http://localhost:10000/test-db

# Test admin dashboard (requires admin token)
curl -X GET http://localhost:10000/api/admin/dashboard \
  -H "Authorization: Bearer {admin_jwt_token}"
```

### Testing Frontend Features

```bash
# Start both servers
cd server && node index.js &
cd client && npm start

# Navigate to key routes:
# http://localhost:3000/          - Home page
# http://localhost:3000/login     - User login
# http://localhost:3000/register  - User registration
# http://localhost:3000/dashboard - User dashboard (protected)
# http://localhost:3000/admin     - Admin dashboard (admin only)
```

### Running with Helper Scripts

```bash
# Start both client and server (from root)
npm run dev

# Or start individually
npm run client  # React frontend on :3000
npm run server  # Express backend on :10000
```

## 🚀 Deployment

### Production Backend (Render)
- **Service**: fetchwork-1.onrender.com
- **Auto-deploy**: Connected to GitHub main branch
- **Environment**: Production MongoDB Atlas cluster

### Production Frontend (Vercel)
- **Primary**: fetchwork.vercel.app
- **Preview**: Automatic preview deployments for PRs
- **Configuration**: vercel.json with Render backend integration

### Production Environment Variables

**Render (Backend):**
- `MONGO_URI`: MongoDB Atlas connection string with authentication
- `JWT_SECRET`: Secure secret key for JWT signing
- `PORT`: Server port (defaults to 10000)
- `NODE_ENV`: production

**Vercel (Frontend):**
- `REACT_APP_API_URL`: https://fetchwork-1.onrender.com

## 🔐 Security Features

- **JWT Authentication**: 7-day token expiry with secure secret
- **Password Security**: 14-round bcrypt hashing (enhanced from 12 rounds)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configured for production domains
- **Helmet Security**: HTTP security headers
- **Input Validation**: Comprehensive request validation
- **Admin Protection**: Role-based access control

## 🧪 Testing & Quality Assurance

### Local Testing Checklist
- ✅ MongoDB connection (`/test-db` endpoint)
- ✅ User registration with firstName/lastName fields
- ✅ JWT authentication and token validation
- ✅ AdminDashboard rendering and API connectivity
- ✅ Protected route functionality
- ✅ Responsive design on mobile devices

### CI/CD Status
- ✅ **PR #7**: All checks passed (3/3)
- ✅ **Vercel Deployments**: Preview environments available
- ✅ **Code Quality**: ESLint and build checks passing

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Verify MONGO_URI in environment variables
- Check MongoDB Atlas network access (IP whitelist: 0.0.0.0/0)
- Ensure correct username/password and authSource=admin

**JWT Authentication Errors**
- Verify JWT_SECRET is set in environment
- Check token format in Authorization header: `Bearer <token>`
- Ensure user exists in database with correct fields

**AdminDashboard Access Denied**
- Create admin user in MongoDB with `role: 'admin'`
- Verify admin token is being sent in requests
- Check admin middleware authentication logic

**Frontend Build Issues**
- Run `npm install` in both client and server directories
- Check for missing dependencies in package.json
- Verify Node.js version compatibility (18.20.4 recommended)

## 📊 Development Status

- ✅ **Backend**: Complete with enhanced models and admin system
- ✅ **Frontend**: Comprehensive routing and AdminDashboard
- ✅ **Authentication**: JWT system with enhanced User model
- ✅ **Admin System**: Full dashboard with user/job/payment management
- ✅ **Deployment**: Render backend + Vercel frontend configuration
- ✅ **Testing**: Local endpoints verified, CI/CD passing
- ✅ **Documentation**: Comprehensive README and deployment guides

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 Recent Pull Requests

- **PR #7**: ✅ Restore comprehensive AdminDashboard and deployment configurations from backup
- **PR #6**: ✅ Implement JWT authentication system with user registration and login  
- **PR #5**: ✅ Add /test-db endpoint for MongoDB connection verification

## 📞 Support

For issues or questions:
- Create GitHub issue with detailed description
- Check deployment logs on Render/Vercel dashboards
- Review MongoDB Atlas connection status and logs
- Verify environment variables in production

---

**Last Updated**: January 22, 2025  
**Version**: 2.0.0 (AdminDashboard Restoration Complete)  
**Maintainer**: Chaz (@stancp327)  
**Link to Devin run**: https://app.devin.ai/sessions/9375e0bf42cd410d9fdf014edb91af44
