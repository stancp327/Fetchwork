# 🧠 FetchWork Proven Knowledge Base

## Overview
This document captures all proven troubleshooting techniques, deployment strategies, and debugging approaches discovered during the FetchWork development sessions. Each solution has been tested and verified to work in real scenarios.

---

## 🚨 Critical Vercel Deployment Issues & Solutions

### Issue 1: Blank Pages on Specific Routes
**Problem**: Routes like `/admin`, `/register`, `/browse-services` show completely blank screens while `/` and `/login` work correctly.

**Root Cause**: Vercel not properly detecting React SPA structure, causing routing failures and static file corruption.

**Proven Solutions** (in order of effectiveness):

#### ✅ Solution A: Enhanced vercel.json with Explicit Framework Detection
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

**Why This Works**:
- `"framework": "create-react-app"` triggers proper Vercel internal handling
- `"use": "@vercel/static-build"` explicitly tells Vercel this is a static build
- `buildCommand` ensures build starts from correct directory in monorepo
- `routes` with `"status": 200` prevents static files from being rewritten to HTML

#### ❌ Failed Approaches (Don't Use):
1. **Basic rewrites only**: `{"source": "/(.*)", "destination": "/index.html"}` - Too broad, corrupts static files
2. **Routes without status codes**: Missing `"status": 200` causes static file corruption
3. **Missing framework detection**: Vercel shows "No framework detected" and applies wrong rules

### Issue 2: Static Files Served as HTML (manifest.json corruption)
**Problem**: `/manifest.json` returns HTML instead of JSON, causing "Manifest: Line: 1, column: 1, Syntax error"

**Root Cause**: Vercel rewriting ALL requests to index.html, including static assets.

**Proven Solution**: Explicit static file routing with status codes
```json
{
  "src": "/(.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|json|txt|woff2?|ttf|eot))",
  "status": 200,
  "dest": "/$1"
}
```

**Critical Details**:
- MUST include `"status": 200` - without this, files still get rewritten
- Regex must be comprehensive to catch all static file extensions
- Order matters: static file routes BEFORE catch-all SPA route

**Verification Commands**:
```bash
# Test manifest.json returns valid JSON (not HTML)
curl -I https://yourapp.vercel.app/manifest.json
# Should return: Content-Type: application/json

# Test in browser console - should have no errors
# Navigate to any route and check console for manifest errors
```

### Issue 3: Monorepo Structure Deployment Failures
**Problem**: Vercel build failures due to incorrect path resolution in monorepo.

**Proven Configuration**:
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/build",
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "client/build"
      }
    }
  ]
}
```

**Critical Points**:
- `buildCommand` MUST include `cd client &&` for monorepo
- `outputDirectory` points to actual build output location
- `distDir` in builds config must match actual build directory
- Never use root-level package.json for frontend builds in monorepo

---

## 🔌 WebSocket Implementation Patterns

### Proven Architecture: Hybrid REST + WebSocket
**Why This Works**: REST for historical data, WebSocket for real-time events. Keeps them in sync.

#### Backend Socket Structure (server/socket/events.js)
```javascript
// Proven event handling pattern
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  // Join user to their own room for direct messages
  socket.join(socket.user.id);
  
  // Join conversation rooms
  socket.on('conversation:join', (conversationId) => {
    socket.join(conversationId);
  });
  
  // Message handling with DB persistence
  socket.on('message:send', async (data) => {
    try {
      // Save to database FIRST
      const message = await Message.create({
        conversationId: data.conversationId,
        senderId: socket.user.id,
        content: data.content,
        messageType: data.messageType || 'text'
      });
      
      // Emit to conversation room AFTER successful save
      io.to(data.conversationId).emit('message:receive', {
        message: message,
        conversationId: data.conversationId
      });
    } catch (error) {
      socket.emit('message:error', { error: error.message });
    }
  });
});
```

#### Frontend Socket Hook (client/src/socket/useSocket.js)
```javascript
// Proven React hook pattern
const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const newSocket = io(process.env.REACT_APP_API_URL, {
      auth: { token }
    });
    
    newSocket.on('connect', () => {
      setIsConnected(true);
    });
    
    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);
  
  return { socket, isConnected };
};
```

### Proven Room Management Strategy
- **User Rooms**: `socket.join(userId)` for direct messages
- **Conversation Rooms**: `socket.join(conversationId)` for group chats
- **Admin Rooms**: `socket.join('admin')` for admin monitoring

### Message Persistence Pattern
1. **Save to DB first** - Always persist before emitting
2. **Emit after confirmation** - Only emit if DB save succeeds
3. **Include full message object** - Frontend needs complete data
4. **Error handling** - Emit errors back to sender only

---

## 🛠️ Debugging Techniques That Work

### Vercel Deployment Debugging
```bash
# 1. Check framework detection in Vercel logs
# Look for: "Framework: Create React App" vs "No framework detected"

# 2. Test static file MIME types
curl -I https://yourapp.vercel.app/manifest.json
curl -I https://yourapp.vercel.app/favicon.ico

# 3. Test SPA routing
curl -s https://yourapp.vercel.app/admin | head -20
# Should return HTML with React app, not 404

# 4. Clear Vercel cache (critical step)
# Go to Vercel Dashboard → Project → Deployments
# Click latest → "Redeploy" → "Clear build cache & deploy"
# Wait 5-10 minutes for CDN propagation
```

### WebSocket Debugging
```javascript
// Browser console debugging
const socket = io('http://localhost:10000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('message:receive', (data) => console.log('Message:', data));

// Test message sending
socket.emit('message:send', {
  conversationId: 'test-conversation',
  content: 'Test message',
  messageType: 'text'
});
```

### Local vs Production Testing
```bash
# Local build testing (should match production)
cd client
npm run build
npx serve -s build -p 3001

# Test all routes locally
curl http://localhost:3001/
curl http://localhost:3001/admin
curl http://localhost:3001/manifest.json

# Compare with production
curl https://yourapp.vercel.app/
curl https://yourapp.vercel.app/admin
curl https://yourapp.vercel.app/manifest.json
```

---

## 🚨 Emergency Recovery Procedures

### Vercel Deployment Completely Broken
```bash
# 1. Rollback to last working commit
git log --oneline
git revert HEAD~1
git push origin main

# 2. Minimal emergency vercel.json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

# 3. If monorepo is the issue, temporarily move frontend to root
cp -r client/* .
# Update vercel.json for root deployment
# Redeploy
```

### Backend Service Down (Render)
```bash
# 1. Check service status
curl https://yourapp.onrender.com/test-db

# 2. Check environment variables in Render dashboard
# Verify: MONGO_URI, JWT_SECRET, RESEND_API_KEY

# 3. Manual redeploy with cache clear
# Render Dashboard → Service → Manual Deploy → Clear build cache

# 4. Check logs for specific errors
# Look for: "Cannot read property 'emails' of undefined" (missing RESEND_API_KEY)
```

---

## 📊 Testing Strategies That Work

### Automated Deployment Verification
```javascript
// Proven test script pattern
const tests = [
  { name: 'Homepage', url: 'https://yourapp.vercel.app/' },
  { name: 'Manifest', url: 'https://yourapp.vercel.app/manifest.json' },
  { name: 'Admin Route', url: 'https://yourapp.vercel.app/admin' },
  { name: 'Backend Health', url: 'https://yourbackend.onrender.com/test-db' }
];

for (const test of tests) {
  try {
    const response = await axios.get(test.url, { timeout: 10000 });
    console.log(`✅ ${test.name}: ${response.status}`);
  } catch (error) {
    console.log(`❌ ${test.name}: ${error.message}`);
  }
}
```

### Manual Testing Checklist
1. **Frontend Routes**: Test /, /login, /admin, /register, /browse-services
2. **Static Files**: Verify manifest.json, favicon.ico return correct MIME types
3. **Backend Endpoints**: Test /test-db, /api/auth/login, /api/admin/*
4. **Real-time Features**: WebSocket connection, message send/receive, typing indicators

---

## 🔧 Environment Configuration Patterns

### Proven .env Structure
```bash
# Server (.env.local)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=minimum_32_character_secret_key_here
RESEND_API_KEY=re_your_resend_api_key_here
FROM_EMAIL=noreply@yourapp.com
CLIENT_URL=http://localhost:3000
PORT=10000
NODE_ENV=development

# Client (.env.local)
REACT_APP_API_URL=http://localhost:10000
REACT_APP_CHATBASE_ID=your_chatbase_id
GENERATE_SOURCEMAP=false
```

### Critical Environment Variable Dependencies
- **RESEND_API_KEY**: Service fails to start without this (critical startup dependency)
- **MONGO_URI**: Must include authSource=admin for Atlas
- **JWT_SECRET**: Minimum 32 characters for security
- **CLIENT_URL**: Must match frontend domain for CORS

---

## 🎯 Performance Optimizations

### Vercel Build Optimization
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/build",
  "framework": "create-react-app",
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

### WebSocket Connection Optimization
```javascript
// Reconnection with exponential backoff
const socket = io(url, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5
});
```

---

## 📝 Documentation Patterns

### Proven README Structure
1. **Quick Start (5 minutes)** - Immediate setup for developers
2. **Prerequisites** - Exact versions and accounts needed
3. **Environment Configuration** - Complete .env examples
4. **Troubleshooting** - Specific error scenarios with solutions
5. **Testing & Verification** - Manual and automated testing procedures
6. **Emergency Recovery** - Rollback and recovery procedures

### Commit Message Patterns
```bash
# Feature implementation
feat: implement WebSocket messaging with group chat support

# Bug fixes
fix: resolve Vercel deployment blank pages with proper SPA routing

# Documentation
docs: add comprehensive troubleshooting guide for deployment issues

# Configuration
config: update vercel.json with explicit framework detection
```

---

## 🚀 Deployment Best Practices

### Vercel Deployment Checklist
- [ ] Framework explicitly set to "create-react-app"
- [ ] Build command includes "cd client &&" for monorepo
- [ ] Output directory points to "client/build"
- [ ] Static file routes have "status": 200
- [ ] Cache cleared after configuration changes
- [ ] All routes tested after deployment

### Render Deployment Checklist
- [ ] All environment variables configured
- [ ] RESEND_API_KEY format verified (starts with "re_")
- [ ] Build command set to "npm install"
- [ ] Start command set to "npm start"
- [ ] Root directory set to "server"
- [ ] Manual deploy triggered after env changes

---

## 🔍 Common Pitfalls & How to Avoid Them

### Vercel Pitfalls
1. **Missing framework detection** → Always set `"framework": "create-react-app"`
2. **Static files served as HTML** → Use routes with `"status": 200`
3. **Monorepo path issues** → Include `cd client &&` in build command
4. **Cache not cleared** → Always clear cache after config changes

### WebSocket Pitfalls
1. **Authentication failures** → Verify token in handshake auth
2. **Message echoing** → Don't emit back to sender
3. **Room management** → Join rooms explicitly, don't rely on auto-join
4. **Connection persistence** → Handle reconnection with exponential backoff

### Environment Pitfalls
1. **Missing critical variables** → Service fails to start without RESEND_API_KEY
2. **Wrong variable format** → RESEND_API_KEY must start with "re_"
3. **CORS mismatches** → CLIENT_URL must match frontend domain exactly
4. **MongoDB auth issues** → Include authSource=admin in connection string

---

## 📚 Knowledge Sources & References

### Verified Working Examples
- **Vercel Configuration**: Commit `29ff03d` in devin/1753313630-fix-blank-pages
- **WebSocket Implementation**: PR #35 - Comprehensive WebSocket messaging system
- **Admin Monitoring**: PR #36 - Admin monitoring tools
- **Environment Setup**: FETCHWORK_HANDOFF_SUMMARY.md

### External Documentation
- [Vercel SPA Configuration](https://vercel.com/docs/concepts/projects/project-configuration)
- [Socket.io Authentication](https://socket.io/docs/v4/middlewares/#sending-credentials)
- [Create React App Deployment](https://create-react-app.dev/docs/deployment/)

### Testing Resources
- Automated test scripts in project root
- Manual testing checklists in README.md
- Verification procedures in deployment documentation

---

## 🎯 Success Metrics

### Deployment Success Indicators
- All frontend routes load React content (not blank pages)
- Static files return correct MIME types
- Backend responds to health checks
- WebSocket connections establish successfully
- No console errors in browser

### Performance Benchmarks
- Frontend build time: < 2 minutes
- Backend startup time: < 30 seconds
- WebSocket connection time: < 1 second
- Page load time: < 3 seconds

---

*This knowledge base is continuously updated based on real-world testing and verification. All solutions have been proven to work in the FetchWork production environment.*
