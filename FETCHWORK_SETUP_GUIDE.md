# FetchWork Platform Setup Guide

## Overview

This comprehensive guide provides step-by-step instructions for creating a complete freelance marketplace platform similar to FetchWork. The guide covers everything from initial setup to advanced features like payment processing, dispute resolution, and AI integration.

Based on the successful implementation of FetchWork with 20+ major features, this guide provides proven patterns, common pitfalls, and alternative approaches for building similar platforms.

## Table of Contents

1. [Tech Stack Selection](#tech-stack-selection)
2. [Phase 1: Core Infrastructure Setup](#phase-1-core-infrastructure-setup)
3. [Phase 2: Authentication & User Management](#phase-2-authentication--user-management)
4. [Phase 3: Job Management System](#phase-3-job-management-system)
5. [Phase 4: Service Marketplace](#phase-4-service-marketplace)
6. [Phase 5: Payment & Escrow System](#phase-5-payment--escrow-system)
7. [Phase 6: Communication Features](#phase-6-communication-features)
8. [Phase 7: Advanced Features](#phase-7-advanced-features)
9. [Phase 8: Mobile & UX Optimization](#phase-8-mobile--ux-optimization)
10. [Phase 9: Deployment & Production](#phase-9-deployment--production)
11. [Troubleshooting & Maintenance](#troubleshooting--maintenance)
12. [Alternative Approaches](#alternative-approaches)

---

## Tech Stack Selection

### Recommended Stack (Proven with FetchWork)

**Frontend:**
- **React 18.2.0** - Modern hooks, context API, excellent ecosystem
- **CSS3** - Custom styling with mobile-first responsive design
- **Axios** - HTTP client for API communication
- **React Router** - Client-side routing with protected routes

**Backend:**
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** - Web framework with middleware support
- **MongoDB** - NoSQL database with flexible schema
- **Mongoose** - ODM for MongoDB with validation and relationships

**Authentication:**
- **JWT (JSON Web Tokens)** - Stateless authentication with 7-day expiry
- **bcrypt** - Password hashing with 14 salt rounds
- **express-rate-limit** - Rate limiting for security

**Payment Processing:**
- **Stripe Connect** - Marketplace payments with escrow functionality
- **Stripe Elements** - Secure payment forms and card processing

**Email Services:**
- **Resend** - Modern transactional email service
- **Email Templates** - HTML templates for various notification types

**AI Integration:**
- **Chatbase** - AI-powered customer support chatbot
- **OpenAI API** - Alternative for custom AI implementations

**Deployment:**
- **Vercel** - Frontend hosting with automatic deployments
- **Render** - Backend hosting with auto-deploy from GitHub
- **MongoDB Atlas** - Cloud database hosting
- **GitHub** - Version control with automated CI/CD

### Alternative Tech Stacks

**Option 1: Next.js Full-Stack**
- Next.js 14+ with App Router
- Prisma ORM with PostgreSQL
- NextAuth.js for authentication
- Vercel for full-stack deployment

**Option 2: MERN with TypeScript**
- TypeScript for type safety
- GraphQL with Apollo Server/Client
- PostgreSQL with TypeORM
- AWS deployment (EC2, RDS, S3)

**Option 3: Django + React**
- Django REST Framework backend
- PostgreSQL database
- Django Channels for WebSocket
- Docker containerization

---

## Phase 1: Core Infrastructure Setup

### 1.1 Project Structure Setup

```bash
# Create project structure
mkdir freelance-platform
cd freelance-platform

# Initialize frontend (React)
npx create-react-app client
cd client
npm install axios react-router-dom

# Initialize backend (Express)
cd ..
mkdir server
cd server
npm init -y
npm install express mongoose bcryptjs jsonwebtoken cors helmet express-rate-limit dotenv
npm install -D nodemon
```

### 1.2 Basic Server Configuration

**server/index.js:**
```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for deployment platforms like Render
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.vercel.app'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected!'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Health check endpoint
app.get('/test-db', (req, res) => {
  res.send('✅ MongoDB Connected!');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### 1.3 Environment Variables Setup

**server/.env:**
```bash
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Server
PORT=10000
NODE_ENV=development

# Payment Processing (add later)
STRIPE_SECRET_KEY=sk_test_...

# Email Service (add later)
RESEND_API_KEY=re_...

# AI Chatbot (add later)
REACT_APP_CHATBASE_ID=...
```

**client/.env.local:**
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:10000

# Development
GENERATE_SOURCEMAP=false

# AI Chatbot (add later)
REACT_APP_CHATBASE_ID=...
```

### 1.4 Package.json Scripts

**server/package.json:**
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

---

## Phase 2: Authentication & User Management

### 2.1 User Model Design

**server/models/User.js:**
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['client', 'freelancer', 'both'],
    default: 'both'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  profilePicture: {
    type: String,
    default: '/images/default-avatar.png'
  },
  bio: String,
  skills: [String],
  hourlyRate: Number,
  location: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  stripeAccountId: String,
  stripeAccountStatus: {
    type: String,
    enum: ['pending', 'active', 'restricted'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(14);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate user rating
userSchema.methods.calculateRating = async function() {
  const Review = require('./Review');
  const reviews = await Review.find({ reviewee: this._id });
  
  if (reviews.length === 0) {
    this.rating = 0;
    this.totalReviews = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / reviews.length;
    this.totalReviews = reviews.length;
  }
  
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
```

### 2.2 Authentication Middleware

**server/middleware/auth.js:**
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Create admin-compatible object for middleware compatibility
    req.admin = {
      ...user.toObject(),
      hasPermission: (permission) => true // Admin has all permissions
    };
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    return res.status(403).json({ error: 'Invalid admin token' });
  }
};

module.exports = {
  authenticateToken,
  authenticateAdmin
};
```

---

## Phase 3: Job Management System

### 3.1 Job Model Design

**server/models/Job.js:**
```javascript
const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coverLetter: {
    type: String,
    required: true
  },
  proposedRate: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Web Development',
      'Mobile Development',
      'Design',
      'Writing',
      'Marketing',
      'Data Science',
      'Other'
    ]
  },
  budget: {
    min: Number,
    max: Number,
    type: {
      type: String,
      enum: ['fixed', 'hourly'],
      default: 'fixed'
    }
  },
  skills: [String],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'open'
  },
  proposals: [proposalSchema],
  startDate: Date,
  endDate: Date,
  completedAt: Date,
  paymentStatus: {
    type: String,
    enum: ['pending', 'escrowed', 'released', 'refunded'],
    default: 'pending'
  },
  paymentIntentId: String,
  milestones: [{
    title: String,
    description: String,
    amount: Number,
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'approved'],
      default: 'pending'
    },
    completedAt: Date
  }]
}, {
  timestamps: true
});

// Add proposal method
jobSchema.methods.addProposal = function(proposalData) {
  this.proposals.push(proposalData);
  return this.save();
};

// Accept proposal method
jobSchema.methods.acceptProposal = async function(proposalId, freelancerId) {
  const proposal = this.proposals.id(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  proposal.status = 'accepted';
  this.freelancer = freelancerId;
  this.status = 'in_progress';
  this.startDate = new Date();

  // Reject other proposals
  this.proposals.forEach(p => {
    if (p._id.toString() !== proposalId) {
      p.status = 'rejected';
    }
  });

  // Send notification email
  const emailService = require('../services/emailService');
  const User = require('./User');
  const freelancer = await User.findById(freelancerId);
  
  if (freelancer) {
    await emailService.sendJobNotification(freelancer, this, 'job_accepted');
  }
  
  return this.save();
};

module.exports = mongoose.model('Job', jobSchema);
```

---

## Phase 4: Service Marketplace

### 4.1 Service Model

**server/models/Service.js:**
```javascript
const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['basic', 'standard', 'premium']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 5
  },
  deliveryTime: {
    type: Number,
    required: true,
    min: 1
  },
  revisions: {
    type: Number,
    default: 1
  },
  features: [String]
});

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    required: true,
    maxlength: 1200
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Web Development',
      'Mobile Development',
      'Design',
      'Writing',
      'Marketing',
      'Data Science',
      'Video & Animation',
      'Music & Audio',
      'Programming',
      'Business',
      'Other'
    ]
  },
  subcategory: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    maxlength: 20
  }],
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  packages: {
    basic: packageSchema,
    standard: packageSchema,
    premium: packageSchema
  },
  images: [{
    url: String,
    alt: String
  }],
  faq: [{
    question: String,
    answer: String
  }],
  requirements: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);
```

---

## Phase 5: Payment & Escrow System

### 5.1 Stripe Connect Integration

**server/services/stripeService.js:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  async createConnectAccount(email, country = 'US') {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: country,
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      
      return account;
    } catch (error) {
      console.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  async holdFundsInEscrow(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency,
        capture_method: 'manual',
        metadata: metadata,
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error holding funds in escrow:', error);
      throw error;
    }
  }

  async releaseFundsFromEscrow(paymentIntentId, amountToCapture) {
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: amountToCapture ? Math.round(amountToCapture * 100) : undefined,
      });
      
      return paymentIntent;
    } catch (error) {
      console.error('Error releasing funds from escrow:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();
```

---

## Phase 6: Communication Features

### 6.1 Email Service Integration

**server/services/emailService.js:**
```javascript
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.com';
  }

  async sendWelcomeEmail(user) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Welcome to FetchWork!',
        html: `
          <h1>Welcome to FetchWork, ${user.firstName}!</h1>
          <p>Thank you for joining our freelance marketplace.</p>
          <p>Get started by completing your profile and browsing available jobs.</p>
        `
      });

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendJobNotification(user, job, type, additionalData = {}) {
    try {
      let subject, html;

      switch (type) {
        case 'new_proposal':
          subject = `New proposal for your job: ${job.title}`;
          html = `
            <h2>You have a new proposal!</h2>
            <p><strong>Job:</strong> ${job.title}</p>
            <p><strong>Freelancer:</strong> ${additionalData.firstName} ${additionalData.lastName}</p>
            <p>Log in to your dashboard to review the proposal.</p>
          `;
          break;
        case 'job_accepted':
          subject = `Your proposal was accepted: ${job.title}`;
          html = `
            <h2>Congratulations! Your proposal was accepted.</h2>
            <p><strong>Job:</strong> ${job.title}</p>
            <p>You can now start working on this project.</p>
          `;
          break;
        case 'job_completed':
          subject = `Job completed: ${job.title}`;
          html = `
            <h2>Job has been marked as completed</h2>
            <p><strong>Job:</strong> ${job.title}</p>
            <p>Please review the work and leave feedback.</p>
          `;
          break;
        default:
          return { success: false, error: 'Unknown notification type' };
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject,
        html
      });

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
```

### 6.2 Chatbot Integration

**client/src/components/ChatBot/ChatBot.js:**
```javascript
import React, { useEffect } from 'react';

const ChatBot = () => {
  useEffect(() => {
    // Load Chatbase script
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.defer = true;
    script.setAttribute('chatbotId', process.env.REACT_APP_CHATBASE_ID);
    script.setAttribute('domain', window.location.hostname);
    
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      document.body.removeChild(script);
    };
  }, []);

  return null; // Chatbase renders its own UI
};

export default ChatBot;
```

---

## Phase 7: Advanced Features

### 7.1 Dispute Resolution System

**server/models/Dispute.js:**
```javascript
const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'payment_issue',
      'quality_issue',
      'communication_issue',
      'deadline_issue',
      'scope_change',
      'other'
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  resolution: {
    decision: String,
    reasoning: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    refundAmount: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Dispute', disputeSchema);
```

### 7.2 Reviews System

**server/models/Review.js:**
```javascript
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerType: {
    type: String,
    enum: ['client', 'freelancer'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    maxlength: 100
  },
  comment: {
    type: String,
    maxlength: 1000
  },
  categories: {
    communication: Number,
    quality: Number,
    timeliness: Number,
    professionalism: Number
  },
  response: {
    text: String,
    respondedAt: Date
  },
  helpfulVotes: {
    count: {
      type: Number,
      default: 0
    },
    voters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  }
}, {
  timestamps: true
});

// Add response to review
reviewSchema.methods.addResponse = function(responseText) {
  this.response = {
    text: responseText,
    respondedAt: new Date()
  };
  return this.save();
};

// Add helpful vote
reviewSchema.methods.addHelpfulVote = function(userId) {
  if (!this.helpfulVotes.voters.includes(userId)) {
    this.helpfulVotes.voters.push(userId);
    this.helpfulVotes.count += 1;
  }
  return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);
```

---

## Phase 8: Mobile & UX Optimization

### 8.1 Responsive Design Patterns

**Key CSS Patterns:**
```css
/* Mobile-first approach */
.container {
  padding: 1rem;
  max-width: 100%;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* Hamburger menu for mobile */
.mobile-menu {
  display: block;
}

@media (min-width: 768px) {
  .mobile-menu {
    display: none;
  }
}

/* Notification badges */
.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 8.2 Progressive Enhancement

**Key Principles:**
- Start with basic functionality that works without JavaScript
- Enhance with React components for better UX
- Ensure all critical features work on mobile devices
- Use semantic HTML for accessibility
- Implement proper loading states and error handling

---

## Phase 9: Deployment & Production

### 9.1 Render Backend Deployment

**Critical Deployment Steps:**
1. Set Root Directory to `server`
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Add all environment variables
5. Enable auto-deploy from GitHub main branch

**Common Issues:**
- **Exit Status 127**: Missing start script in package.json
- **MODULE_NOT_FOUND**: Missing route files or dependencies
- **Exit Status 1**: Missing environment variables

**Solutions:**
- Ensure `"start": "node index.js"` in server/package.json
- Verify all route files exist and are properly exported
- Add all required environment variables in Render dashboard

### 9.2 Vercel Frontend Deployment

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/client/build/static/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/client/build/index.html"
    }
  ]
}
```

### 9.3 Environment Variables Checklist

**Backend (Render):**
- `MONGO_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Secure random string for JWT signing
- `STRIPE_SECRET_KEY`: Stripe secret key for payments
- `RESEND_API_KEY`: Resend API key for emails
- `REACT_APP_CHATBASE_ID`: Chatbase chatbot ID
- `PORT`: 10000 (default for Render)
- `NODE_ENV`: production

**Frontend (Vercel):**
- `REACT_APP_API_URL`: Backend URL (e.g., https://your-app.onrender.com)
- `REACT_APP_CHATBASE_ID`: Chatbase chatbot ID

---

## Troubleshooting & Maintenance

### Common Issues and Solutions

**1. Render Deployment Failures**
- **Exit Status 127**: Missing start script in package.json
- **MODULE_NOT_FOUND**: Missing route files or dependencies
- **Exit Status 1**: Missing environment variables

**Solutions:**
- Ensure `"start": "node index.js"` in server/package.json
- Verify all route files exist and are properly exported
- Add all required environment variables in Render dashboard

**2. Authentication Issues**
- **Invalid admin token**: User/Admin model mismatch
- **Token expired**: JWT expiry handling
- **CORS errors**: Frontend/backend domain mismatch

**Solutions:**
- Use User model with isAdmin flag for admin authentication
- Implement token refresh or extend expiry time
- Configure CORS with correct frontend domains

**3. Payment Integration Issues**
- **Stripe Connect setup**: Account creation and verification
- **Webhook handling**: Event processing and security
- **Escrow management**: Fund holding and release

**Solutions:**
- Follow Stripe Connect Express account setup
- Implement proper webhook signature verification
- Use manual capture for escrow functionality

**4. Database Performance**
- **Slow queries**: Missing indexes
- **Connection issues**: MongoDB Atlas network access
- **Data validation**: Schema enforcement

**Solutions:**
- Add indexes for frequently queried fields
- Whitelist IP addresses (0.0.0.0/0 for development)
- Use Mongoose schema validation and middleware

### Monitoring and Maintenance

**Performance Monitoring:**
- Monitor API response times
- Track database query performance
- Watch for memory leaks and CPU usage

**Security Audits:**
- Regular dependency updates
- JWT secret rotation
- Rate limiting effectiveness
- Input validation testing

**Backup Strategies:**
- MongoDB Atlas automated backups
- Code repository backups
- Environment variable documentation
- Database schema versioning

---

## Alternative Approaches

### Technology Alternatives

**1. Next.js Full-Stack Alternative**
```javascript
// pages/api/auth/login.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Authentication logic
    const { email, password } = req.body;
    // ... implementation
  }
}

// Advantages: Single deployment, better SEO, simplified architecture
// Disadvantages: Vendor lock-in, less flexibility for complex backends
```

**2. GraphQL Alternative**
```javascript
// Apollo Server setup
const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
  }
  
  type Query {
    me: User
  }
`;

// Advantages: Flexible queries, strong typing, single endpoint
// Disadvantages: Learning curve, caching complexity, over-fetching prevention
```

**3. Microservices Architecture**
```yaml
# docker-compose.yml
services:
  auth-service:
    build: ./services/auth
    ports:
      - "3001:3000"
  
  payment-service:
    build: ./services/payments
    ports:
      - "3002:3000"

# Advantages: Scalability, technology diversity, fault isolation
# Disadvantages: Complexity, network overhead, data consistency challenges
```

### Deployment Alternatives

**1. AWS Deployment**
- **Frontend**: S3 + CloudFront
- **Backend**: EC2 or Lambda
- **Database**: RDS or DynamoDB
- **Advantages**: Full control, enterprise features
- **Disadvantages**: Higher complexity, cost management

**2. Docker Containerization**
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**3. Serverless Architecture**
- **Functions**: Vercel Functions or Netlify Functions
- **Database**: FaunaDB or Supabase
- **Advantages**: Auto-scaling, pay-per-use
- **Disadvantages**: Cold starts, vendor lock-in

### Database Alternatives

**1. PostgreSQL with Prisma**
```javascript
// schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  firstName String
  lastName  String
  jobs      Job[]
  createdAt DateTime @default(now())
}

// Advantages: Strong consistency, complex queries, migrations
// Disadvantages: Less flexible schema, SQL knowledge required
```

**2. Supabase (PostgreSQL + Auth + Real-time)**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Built-in authentication and real-time subscriptions
// Advantages: Rapid development, built-in features
// Disadvantages: Vendor lock-in, limited customization
```

---

## Conclusion

This comprehensive setup guide provides a proven blueprint for creating a full-featured freelance marketplace platform. The FetchWork implementation demonstrates that with careful planning and execution, you can build a production-ready platform with:

- **20+ Major Features**: Complete marketplace functionality
- **Scalable Architecture**: Proven to handle real-world usage
- **Modern Tech Stack**: Industry-standard technologies
- **Production Deployment**: Live and operational platform

**Key Success Factors:**
1. **Start Simple**: Begin with core features and iterate
2. **Plan for Scale**: Design architecture with growth in mind
3. **Test Thoroughly**: Validate each feature before moving forward
4. **Document Everything**: Maintain comprehensive documentation
5. **Monitor Continuously**: Track performance and user feedback

**Next Steps:**
- Follow this guide phase by phase
- Adapt technologies to your specific needs
- Test each phase thoroughly before proceeding
- Consider alternative approaches based on your requirements
- Plan for ongoing maintenance and feature development

The freelance marketplace space offers significant opportunities, and with this guide, you have a roadmap to build a competitive platform that can serve thousands of users effectively.

---

*This setup guide is based on the successful implementation of FetchWork platform. Last updated: January 23, 2025*
