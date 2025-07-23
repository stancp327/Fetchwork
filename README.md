# FetchWork

All-in-one freelance platform for remote and local services with comprehensive admin dashboard, secure payments, messaging, and AI support.

## 🚀 Recent Updates (January 2025)

**✅ Complete Platform MVP Implementation (20 Major PRs)**
- Comprehensive freelance marketplace with all core features
- Payment & Escrow System with Stripe Connect integration
- Service Listings (Fiverr-style marketplace functionality)
- Dispute Resolution System with admin mediation
- Reviews & Ratings System with responses and helpful votes
- Email Integration with Resend for transactional emails
- AI Chatbot Integration with Chatbase for customer support
- Mobile-responsive design with notification badges
- Onboarding features with progress tracking
- Admin dashboard with comprehensive management tools

**✅ Production Deployment Fixes**
- Resolved Render deployment failures (missing routes, environment variables)
- Fixed admin authentication middleware (User/Admin model compatibility)
- Configured all required environment variables (Stripe, Resend, Chatbase)
- Backend live at https://fetchwork-1.onrender.com
- Frontend live at https://fetchwork-dusky.vercel.app

**✅ Major Feature Implementations**
- **Service Listings (PR #19)**: Fiverr-style marketplace with service creation and browsing
- **Payment System (PR #31)**: Stripe Connect with escrow functionality
- **Dispute Resolution (PR #27)**: Complete dispute filing and resolution workflow
- **Reviews System (PR #28)**: Comprehensive rating and review system
- **Email Integration (PR #32)**: Transactional emails and notifications
- **Mobile Optimization (PR #29)**: Responsive design with mobile-first approach
- **Onboarding (PR #26)**: Profile completion, proposal wizard, milestone tracking

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Enhanced User Model**: firstName/lastName fields, 14-round bcrypt hashing, role switching, user management methods
- **Admin System**: Role-based access control, comprehensive dashboard endpoints with dispute/email management
- **Database Models**: User, Admin, Job, Payment, Review, Dispute, Service, Message schemas with advanced validation
- **Authentication**: JWT-based auth with 7-day token expiry, rate limiting, security middleware
- **Payment System**: Stripe Connect integration with escrow functionality
- **Email Service**: Resend integration for transactional emails and notifications
- **API Routes**: RESTful endpoints for auth, admin, users, jobs, services, payments, reviews, disputes, email, messages

### Frontend (React)
- **Comprehensive Routing**: Protected routes, public routes, admin-only sections, service marketplace
- **AdminDashboard**: User management, job oversight, payment controls, dispute resolution, email management, platform statistics
- **Service Marketplace**: Fiverr-style service listings with creation, browsing, and purchasing
- **Payment Interface**: Stripe Connect onboarding, payment history, escrow management
- **Dispute System**: Filing, tracking, and resolution interface for job disputes
- **Reviews System**: Rating and review interface with responses and helpful votes
- **Authentication Context**: Centralized auth state management with role switching
- **Component Structure**: 50+ modular components with Home, Auth, Dashboard, Jobs, Services, Profile, Messages, Payments, Disputes, Reviews, Admin
- **Mobile-First Design**: Responsive design with notification badges, hamburger menu, and mobile optimization
- **Onboarding**: Profile completion progress, proposal wizard, milestone tracking

## 📁 Project Structure

```
FetchWork/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/         # AdminDashboard, AdminDisputePanel, AdminEmailPanel
│   │   │   ├── Auth/          # Login/Register components
│   │   │   ├── Dashboard/     # User dashboard with role switching
│   │   │   ├── Jobs/          # Job browsing/posting/details
│   │   │   ├── Services/      # Service marketplace (Fiverr-style)
│   │   │   ├── Payments/      # Stripe Connect, payment history, escrow
│   │   │   ├── Disputes/      # Dispute filing and resolution
│   │   │   ├── Reviews/       # Rating and review system
│   │   │   ├── Profile/       # User profiles with edit/view modes
│   │   │   ├── Messages/      # Real-time messaging
│   │   │   ├── Navigation/    # Site navigation with notification badges
│   │   │   ├── Onboarding/    # Profile completion, proposal wizard
│   │   │   ├── ChatBot/       # Chatbase integration
│   │   │   └── Home/          # Homepage with FetchWork branding
│   │   ├── context/           # React contexts (Auth, Messaging, Role, Stripe)
│   │   ├── hooks/             # Custom hooks (useNotifications)
│   │   └── App.js            # Main routing component
│   └── package.json
├── server/                     # Node.js backend
│   ├── models/                # Mongoose schemas
│   │   ├── User.js           # Enhanced user model with role switching
│   │   ├── Admin.js          # Admin user model
│   │   ├── Job.js            # Job posting model with proposals
│   │   ├── Service.js        # Service marketplace model
│   │   ├── Payment.js        # Payment tracking with escrow
│   │   ├── Review.js         # Review system with responses
│   │   ├── Dispute.js        # Dispute resolution model
│   │   └── Message.js        # Real-time messaging model
│   ├── routes/               # API routes
│   │   ├── admin.js          # Admin dashboard routes
│   │   ├── auth.js           # Authentication routes
│   │   ├── users.js          # User management routes
│   │   ├── jobs.js           # Job management routes
│   │   ├── services.js       # Service marketplace routes
│   │   ├── payments.js       # Payment and escrow routes
│   │   ├── reviews.js        # Review system routes
│   │   ├── disputes.js       # Dispute resolution routes
│   │   ├── email.js          # Email service routes
│   │   └── messages.js       # Messaging routes
│   ├── services/             # External service integrations
│   │   ├── stripeService.js  # Stripe Connect integration
│   │   └── emailService.js   # Resend email service
│   ├── middleware/           # Custom middleware
│   │   └── auth.js           # JWT authentication with admin support
│   ├── index.js              # Main server file
│   └── package.json
├── vercel.json                # Vercel deployment config
├── DEPLOYMENT.md              # Deployment instructions
├── FETCHWORK_SETUP_GUIDE.md   # Comprehensive setup guide
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
- **Registration**: Enhanced with firstName/lastName fields and role selection
- **Authentication**: JWT-based with 7-day token expiry and role switching
- **Security**: 14-round bcrypt hashing, rate limiting (100 req/15min)
- **Profile Management**: Comprehensive user profiles with skills, ratings, verification, edit/view modes
- **Role Switching**: Dynamic switching between client and freelancer roles

### Service Marketplace (Fiverr-style)
- **Service Creation**: Freelancers can create service listings with packages and pricing
- **Service Browsing**: Clients can browse and search services by category
- **Service Purchasing**: Direct service ordering with payment integration
- **Service Management**: Dashboard for managing active services and orders

### Payment & Escrow System
- **Stripe Connect**: Full marketplace payment processing with Connect accounts
- **Escrow Management**: Secure fund holding until job completion
- **Payment History**: Comprehensive transaction tracking and reporting
- **Payout Management**: Automated payouts to freelancer accounts
- **Fee Structure**: Platform fee collection and management

### Dispute Resolution
- **Dispute Filing**: Structured dispute filing system for job conflicts
- **Admin Mediation**: Admin dashboard for dispute review and resolution
- **Evidence Upload**: File and message evidence collection
- **Resolution Tracking**: Timeline-based dispute status tracking
- **Automated Notifications**: Email notifications for dispute updates

### Reviews & Ratings
- **Comprehensive Reviews**: 5-star rating system with detailed feedback
- **Review Responses**: Reviewees can respond to reviews
- **Helpful Votes**: Community voting on review helpfulness
- **Rating Aggregation**: Automatic user rating calculation
- **Review Moderation**: Admin tools for review management

### Admin Dashboard
- **User Oversight**: View, suspend, activate users with detailed analytics
- **Job Management**: Monitor job postings, track completion rates
- **Payment Controls**: Track payment volume, manage escrow, handle disputes
- **Dispute Resolution**: Comprehensive dispute management interface
- **Email Management**: Send broadcasts, test emails, manage templates
- **Platform Statistics**: Real-time metrics and activity monitoring
- **Review Moderation**: Moderate reviews, manage ratings, handle flags

### Communication Features
- **Real-time Messaging**: WebSocket-based messaging between users
- **Email Notifications**: Transactional emails for all major actions
- **AI Chatbot**: Chatbase integration for customer support
- **Notification System**: Real-time notification badges with mobile support
- **Email Templates**: Welcome, verification, password reset, job notifications

### Mobile & UX Features
- **Mobile-First Design**: Responsive design optimized for mobile devices
- **Notification Badges**: Real-time notification system with badges
- **Hamburger Menu**: Mobile navigation with collapsible menu
- **Onboarding**: Profile completion progress, proposal wizard, milestone tracking
- **Progressive Enhancement**: Works on all devices with graceful degradation

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
- **Service**: https://fetchwork-1.onrender.com
- **Auto-deploy**: Connected to GitHub main branch
- **Environment**: Production MongoDB Atlas cluster
- **Status**: ✅ Live and operational with all features

### Production Frontend (Vercel)
- **Primary**: https://fetchwork-dusky.vercel.app
- **Preview**: Automatic preview deployments for PRs
- **Configuration**: vercel.json with Render backend integration
- **Status**: ✅ Live with all 20+ features deployed

### Production Environment Variables

**Render (Backend):**
- `MONGO_URI`: MongoDB Atlas connection string with authentication
- `JWT_SECRET`: Secure secret key for JWT signing
- `STRIPE_SECRET_KEY`: Stripe Connect secret key for payments
- `RESEND_API_KEY`: Resend API key for transactional emails
- `REACT_APP_CHATBASE_ID`: Chatbase chatbot integration ID
- `PORT`: Server port (defaults to 10000)
- `NODE_ENV`: production

**Vercel (Frontend):**
- `REACT_APP_API_URL`: https://fetchwork-1.onrender.com
- `REACT_APP_CHATBASE_ID`: Chatbase chatbot integration ID

### Service Integrations
- **Stripe Connect**: Marketplace payments and escrow functionality
- **Resend**: Transactional email service (stancp327@gmail.com account)
- **Chatbase**: AI-powered customer support chatbot
- **MongoDB Atlas**: Cloud database cluster (fetchwork.sch7kdf.mongodb.net)
- **GitHub**: Source code repository with automated deployments

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

## 📝 Recent Pull Requests (January 2025 Session)

### Core System & Authentication
- **PR #14**: ✅ Fix admin authentication: resolve User/Admin model mismatch
- **PR #16**: ✅ Hotfix: Add missing start script for Render deployment
- **PR #17**: ✅ Fix critical user flow issues: job details view, admin auth, and logout
- **PR #33**: ✅ Fix Render deployment: Add missing routes/reviews.js and services/stripeService.js

### Frontend Components & User Experience
- **PR #15**: ✅ Add user-facing API endpoints and functional frontend components
- **PR #18**: ✅ Implement client notification system for job proposals
- **PR #20**: ✅ Implement Apply-to-Job UI enhancements and Role Toggle with persistent state
- **PR #21**: ✅ Enhance homepage with FetchWork logo and professional design
- **PR #22**: 🔄 Fix role switcher permissions: restrict toggle to freelancers only
- **PR #23**: 🔄 Implement comprehensive Profile Pages with edit/view modes
- **PR #24**: ✅ Enhance Job Status Tags with prominent visual display
- **PR #25**: ✅ Implement notification badge system with mobile hamburger menu

### Advanced Features & Marketplace
- **PR #19**: ✅ Implement Service Listings with Fiverr-style functionality
- **PR #26**: ✅ Implement comprehensive onboarding features: Profile Completion Progress Bars, Proposal Wizard Flow, and Onboarding Milestone Tracker
- **PR #27**: ✅ Implement comprehensive Dispute Resolution System based on ChatGPT wireframes
- **PR #28**: 🔄 Implement comprehensive Ratings & Reviews system
- **PR #29**: ✅ Implement comprehensive mobile responsiveness improvements
- **PR #30**: ✅ Add default avatar image to fix broken image references
- **PR #31**: 🔄 Implement comprehensive Payment & Escrow System with Stripe Connect
- **PR #32**: ✅ Implement comprehensive Email & Chatbot Integration

### Summary
- **Total PRs**: 20 major feature implementations
- **Merged**: 16 successfully integrated features
- **Open**: 4 pending review/merge
- **Status**: Complete freelance marketplace platform with all core features operational

## 📞 Support

For issues or questions:
- Create GitHub issue with detailed description
- Check deployment logs on Render/Vercel dashboards
- Review MongoDB Atlas connection status and logs
- Verify environment variables in production

---

**Last Updated**: January 23, 2025  
**Version**: 3.0.0 (Complete Freelance Marketplace Platform)  
**Maintainer**: Chaz (@stancp327)  
**Link to Devin run**: https://app.devin.ai/sessions/a81569fff97741a2be10e7a59239d5ce

<!-- Deployment trigger: 2025-01-23 07:32 -->
