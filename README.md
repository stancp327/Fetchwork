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

## 🚀 Getting Started

### Prerequisites
- **Node.js 18.20.4** (use nvm for version management)
- **MongoDB Atlas account** (free tier available)
- **Git** (latest version)
- **Vercel account** (for frontend deployment)
- **Render account** (for backend deployment)

### Quick Start (5 minutes)

1. **Clone and Setup**
   ```bash
   git clone https://github.com/stancp327/Fetchwork.git
   cd Fetchwork
   
   # Use correct Node.js version
   nvm use 18.20.4  # or nvm install 18.20.4
   
   # Install all dependencies
   npm install
   cd client && npm install
   cd ../server && npm install
   cd ..
   ```

2. **Environment Configuration**
   
   **Server Environment** (create `server/.env.local`):
   ```env
   # Database
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fetchwork
   
   # Authentication
   JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
   
   # Email Service (Resend)
   RESEND_API_KEY=re_your_resend_api_key_here
   FROM_EMAIL=noreply@yourapp.com
   
   # Frontend URL
   CLIENT_URL=http://localhost:3000
   
   # Optional: Socket.io configuration
   SOCKET_CORS_ORIGIN=http://localhost:3000
   
   # Server Configuration
   PORT=10000
   NODE_ENV=development
   ```
   
   **Client Environment** (create `client/.env.local`):
   ```env
   # Backend API
   REACT_APP_API_URL=http://localhost:10000
   
   # Chatbot Integration
   REACT_APP_CHATBASE_ID=your_chatbase_chatbot_id
   
   # Optional: Development settings
   GENERATE_SOURCEMAP=false
   ```

3. **Database Setup (MongoDB Atlas)**
   ```bash
   # 1. Go to https://cloud.mongodb.com
   # 2. Create free cluster
   # 3. Create database user
   # 4. Whitelist IP (0.0.0.0/0 for development)
   # 5. Get connection string
   # 6. Replace <password> and <dbname> in connection string
   ```

4. **Start Development**
   ```bash
   # Option 1: Start both services (recommended)
   npm run dev
   
   # Option 2: Start individually
   npm run client   # Frontend: http://localhost:3000
   npm run server   # Backend: http://localhost:10000
   
   # Option 3: Manual start
   cd client && npm start &
   cd server && node index.js
   ```

### Advanced Setup

#### Email Service (Resend)
1. **Create Account**: Go to [resend.com](https://resend.com)
2. **Generate API Key**: Dashboard → API Keys → Create
3. **Add to Environment**: Copy key to `RESEND_API_KEY`
4. **Verify Setup**: Check admin panel email tab

#### Chatbot Integration (Chatbase)
1. **Create Chatbot**: Go to [chatbase.co](https://chatbase.co)
2. **Get Chatbot ID**: Settings → Embed → Copy ID
3. **Add to Environment**: Set `REACT_APP_CHATBASE_ID`
4. **Test Widget**: Should appear on frontend pages

#### WebSocket Messaging
- **Automatic**: Starts with backend server
- **Port**: Same as backend (10000)
- **Test**: Real-time messaging in app
- **Debug**: Check browser console for socket connections

### Production Deployment

#### Frontend (Vercel)
1. **Connect Repository**: Import from GitHub
2. **Configure Build**:
   - Build Command: `cd client && npm run build`
   - Output Directory: `client/build`
   - Root Directory: Leave empty (monorepo)
3. **Environment Variables**:
   ```env
   REACT_APP_API_URL=https://your-backend.onrender.com
   REACT_APP_CHATBASE_ID=your_chatbase_id
   ```
4. **Deploy**: Automatic on git push

#### Backend (Render)
1. **Create Web Service**: Connect GitHub repository
2. **Configure Service**:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
3. **Environment Variables**: Add all server environment variables
4. **Deploy**: Automatic on git push

### Development Workflow

#### Local Testing
```bash
# Run tests
cd client && npm test
cd server && npm test

# Build for production
cd client && npm run build

# Serve production build locally
cd client && npx serve -s build

# Check backend health
curl http://localhost:10000/test-db
```

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

#### Debugging
```bash
# Check logs
npm run logs:client
npm run logs:server

# Debug WebSocket
# Open browser console and check socket connections

# Test API endpoints
curl -X POST http://localhost:10000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Project Structure
```
Fetchwork/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/               # React components
│   ├── build/             # Production build
│   └── package.json       # Frontend dependencies
├── server/                # Express backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── socket/            # WebSocket handlers
│   ├── services/          # Business logic
│   └── package.json       # Backend dependencies
├── vercel.json            # Vercel deployment config
├── package.json           # Root package (dev scripts)
└── README.md              # This file
```

### Verification Checklist

After setup, verify these work:
- [ ] Frontend loads at http://localhost:3000
- [ ] Backend responds at http://localhost:10000/test-db
- [ ] User registration creates account
- [ ] Login redirects to dashboard
- [ ] Admin panel accessible (create admin user first)
- [ ] Real-time messaging works
- [ ] Email service configured (check admin panel)
- [ ] Chatbot widget appears

### Common Setup Issues

#### Node.js Version
```bash
# Check version
node --version  # Should be 18.20.4

# Fix version
nvm install 18.20.4
nvm use 18.20.4
nvm alias default 18.20.4
```

#### Port Conflicts
```bash
# Check what's using port 3000/10000
lsof -i :3000
lsof -i :10000

# Kill processes if needed
kill -9 $(lsof -t -i:3000)
```

#### MongoDB Connection
```bash
# Test connection string
mongosh "your_connection_string"

# Common issues:
# - Wrong password
# - IP not whitelisted
# - Network restrictions
```

#### Environment Variables Not Loading
```bash
# Check if files exist
ls -la client/.env.local
ls -la server/.env.local

# Verify format (no spaces around =)
cat server/.env.local
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

### Vercel Deployment Issues

#### Blank Pages on Admin/Register Routes
**Symptoms**: Routes like `/admin`, `/register`, `/browse-services` show blank pages while `/` and `/login` work
**Root Cause**: Vercel not detecting React SPA structure properly, causing routing failures

**Solutions**:
1. **Clear Vercel Build Cache**:
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click latest deployment → "Redeploy" → "Clear build cache & deploy"
   - Wait 5-10 minutes for CDN propagation

2. **Verify vercel.json Configuration**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "client/package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "client/build"
         }
       }
     ],
     "routes": [
       {
         "src": "/(.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|json|txt|woff2?|ttf|eot))",
         "status": 200,
         "dest": "/$1"
       },
       {
         "src": "/(favicon\\.ico|manifest\\.json)",
         "status": 200,
         "dest": "/$1"
       },
       {
         "src": "/(admin|register|browse-services|dashboard|.*)",
         "dest": "/index.html"
       }
     ],
     "buildCommand": "cd client && npm run build",
     "outputDirectory": "client/build",
     "framework": "create-react-app"
   }
   ```

3. **Check Framework Detection**:
   - Vercel logs should show "Framework: Create React App"
   - If showing "No framework detected", rebuild with cache clear

#### Static Files Served as HTML
**Symptoms**: `/manifest.json` returns HTML instead of JSON, causing "Manifest: Line: 1, column: 1, Syntax error"
**Cause**: Vercel rewriting static file requests to index.html

**Solutions**:
1. Ensure static file routes in vercel.json have `"status": 200` and `"dest": "/$1"`
2. Test static files directly: `https://yourapp.vercel.app/manifest.json`
3. Check browser Network tab for correct MIME types

#### Monorepo Structure Issues
**Symptoms**: Build failures or incorrect file paths
**Cause**: Vercel not finding correct build directory in monorepo

**Solutions**:
1. Verify `buildCommand` includes `cd client &&`
2. Ensure `outputDirectory` points to `client/build`
3. Check `distDir` in builds config matches actual build output

### WebSocket Messaging Issues

#### Connection Failures
**Symptoms**: Real-time messaging not working, socket connection errors
**Cause**: Socket.io configuration or authentication problems

**Solutions**:
1. **Check Socket.io Availability**:
   ```bash
   curl https://fetchwork-1.onrender.com/socket.io/socket.io.js
   ```
2. **Verify Environment Variables**:
   - `SOCKET_CORS_ORIGIN` set to frontend URL
   - `CLIENT_URL` matches frontend domain
3. **Test Connection**:
   - Open browser console on frontend
   - Look for socket connection logs
   - Check for authentication errors

#### Message Delivery Issues
**Symptoms**: Messages not appearing in real-time, delivery failures
**Cause**: Room management or event handling problems

**Solutions**:
1. **Check Room Joining**:
   - Users should join rooms based on conversation ID
   - Verify socket.join() calls in backend
2. **Test Event Flow**:
   - message:send → save to DB → emit to room
   - Verify all steps complete successfully
3. **Debug Tools**:
   - Use browser DevTools → Network → WS tab
   - Monitor socket events and responses

### Backend Deployment Issues

**MongoDB Connection Failed**
- Verify MONGO_URI in environment variables
- Check MongoDB Atlas network access (IP whitelist: 0.0.0.0/0)
- Ensure correct username/password and authSource=admin

**JWT Authentication Errors**
- Verify JWT_SECRET is set in environment
- Check token format in Authorization header: `Bearer <token>`
- Ensure user exists in database with correct fields

**Email Service Failures**
- **Cause**: Missing RESEND_API_KEY environment variable
- **Solution**: Add RESEND_API_KEY to your Render environment variables
- **Critical**: Service fails to start without this variable

**AdminDashboard Access Denied**
- Create admin user in MongoDB with `role: 'admin'`
- Verify admin token is being sent in requests
- Check admin middleware authentication logic

**CORS Errors**
- **Cause**: Frontend and backend URL mismatch
- **Solution**: Update CORS configuration in server/index.js
- **Check**: Verify CLIENT_URL environment variable matches frontend domain

### Local Development Issues

**Node.js Version Conflicts**
- **Cause**: Wrong Node.js version
- **Solution**: Use Node.js 18.20.4 (specified in .nvmrc)
- **Commands**: `nvm use 18.20.4` or `nvm install 18.20.4`

**Build Failures with OpenSSL**
- **Symptoms**: Build fails with OpenSSL legacy provider errors
- **Solution**: Use `NODE_OPTIONS="--openssl-legacy-provider" npm run build`
- **Note**: This is automatically configured in the project

**Frontend Build Issues**
- Run `npm install` in both client and server directories
- Check for missing dependencies in package.json
- Verify Node.js version compatibility (18.20.4 recommended)

**Environment Variables Not Loading**
- **Cause**: Missing .env.local files
- **Solution**: Create `.env.local` files in both client/ and server/ directories
- **Security**: Never commit .env.local files to git

### Testing and Verification

#### Manual Testing Checklist
1. **Frontend Routes**:
   - [ ] Homepage (/) loads correctly
   - [ ] Login (/login) works
   - [ ] Admin panel (/admin) accessible
   - [ ] Registration (/register) functional
   - [ ] Browse services (/browse-services) loads

2. **Static Files**:
   - [ ] manifest.json returns valid JSON
   - [ ] favicon.ico loads correctly
   - [ ] CSS/JS files load with correct MIME types

3. **Backend Endpoints**:
   - [ ] /test-db returns MongoDB connection status
   - [ ] /api/auth/login accepts credentials
   - [ ] /api/admin/* routes require authentication

4. **Real-time Features**:
   - [ ] WebSocket connection establishes
   - [ ] Messages send/receive in real-time
   - [ ] Typing indicators work
   - [ ] Online status updates

#### Debugging Tools
- **Browser DevTools**: Check Network tab for failed requests
- **Vercel Logs**: Monitor deployment and runtime logs
- **Render Logs**: Check backend service logs
- **Socket.io Admin**: Use for WebSocket debugging

#### Automated Testing Script
```bash
# Create test script
cat > test-deployment.js << 'EOF'
const axios = require('axios');

async function testDeployment() {
  const tests = [
    { name: 'Homepage', url: 'https://fetchwork.vercel.app/' },
    { name: 'Manifest', url: 'https://fetchwork.vercel.app/manifest.json' },
    { name: 'Admin Route', url: 'https://fetchwork.vercel.app/admin' },
    { name: 'Backend Health', url: 'https://fetchwork-1.onrender.com/test-db' }
  ];
  
  for (const test of tests) {
    try {
      const response = await axios.get(test.url, { timeout: 10000 });
      console.log(`✅ ${test.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

testDeploymentTest();
EOF

# Run test
node test-deployment.js
```

### Emergency Deployment Recovery

If deployment is completely broken:

1. **Rollback to last working commit**:
   ```bash
   git log --oneline  # Find last working commit
   git revert HEAD~1  # Revert last commit
   git push origin main
   ```

2. **Minimal vercel.json for emergency**:
   ```json
   {
     "version": 2,
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

3. **Move frontend to root** (temporary fix):
   ```bash
   # Copy client files to root
   cp -r client/* .
   # Update vercel.json for root deployment
   # Redeploy
   ```

4. **Contact support**:
   - Vercel: Check status.vercel.com
   - Render: Check status.render.com
   - Create GitHub issue with deployment logs

### Getting Help

If you encounter issues:
1. **Check Logs**: Review Vercel and Render deployment logs
2. **Verify Environment**: Ensure all environment variables are set
3. **Test Locally**: Confirm functionality works in development
4. **Clear Caches**: Try clearing browser and deployment caches
5. **Check Status**: Verify service status pages for Vercel/Render

**Emergency Contacts**:
- Create GitHub issue for code-related problems
- Check Vercel/Render status pages for service outages
- Review this troubleshooting guide for common solutions

**Useful Commands**:
```bash
# Test local build
cd client && npm run build && npx serve -s build

# Check backend health
curl https://fetchwork-1.onrender.com/test-db

# Verify frontend deployment
curl -I https://fetchwork.vercel.app/manifest.json
```

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

<!-- Deployment trigger: 2025-07-22 10:38 -->
