import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import { MessagingProvider } from './context/MessagingContext';
import Home from './components/Home/Home';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import VerifyEmail from './components/Auth/VerifyEmail';
import OAuthCallback from './components/Auth/OAuthCallback';
import Navigation from './components/Navigation/Navigation';
import Footer from './components/common/Footer';
import ChatBot from './components/ChatBot/ChatBot';
import './App.css';

const Dashboard = React.lazy(() => import('./components/Dashboard/Dashboard'));
const BrowseJobs = React.lazy(() => import('./components/Jobs/BrowseJobs'));
const BrowseServices = React.lazy(() => import('./components/Services/BrowseServices'));
const CreateService = React.lazy(() => import('./components/Services/CreateService'));
const ServiceDetails = React.lazy(() => import('./components/Services/ServiceDetails'));
const PostJob = React.lazy(() => import('./components/Jobs/PostJob'));
const JobDetails = React.lazy(() => import('./components/Jobs/JobDetails'));
const Profile = React.lazy(() => import('./components/Profile/Profile'));
const PublicProfile = React.lazy(() => import('./components/Profile/PublicProfile'));

const FreelancerDiscovery = React.lazy(() => import('./components/Freelancers/FreelancerDiscovery'));
const Messages = React.lazy(() => import('./components/Messages/Messages'));
const Payments = React.lazy(() => import('./components/Payments/Payments'));
const Reviews = React.lazy(() => import('./components/Reviews/Reviews'));
const UniversalSearch = React.lazy(() => import('./components/Search/UniversalSearch'));
const AdminDashboard = React.lazy(() => import('./components/Admin/AdminDashboard'));
const ProjectManagement = React.lazy(() => import('./components/Projects/ProjectManagement'));
const Security = React.lazy(() => import('./components/Security/Security'));
const DisputeCenter = React.lazy(() => import('./components/Disputes/DisputeCenter'));
const OnboardingWizard = React.lazy(() => import('./components/Onboarding/ProfileWizard/Wizard'));

const ContactUs = React.lazy(() => import('./components/common/ContactUs'));
const Support = React.lazy(() => import('./components/common/Support'));

class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    console.error('❌ AuthErrorBoundary caught error:', error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ AuthErrorBoundary error details:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-error-boundary">
          <h2>Authentication Error</h2>
          <p>Something went wrong with authentication. Please try again.</p>
          <button onClick={this.handleRetry} className="retry-button">
            Retry
          </button>
          <button onClick={() => window.location.href = '/login'} className="login-button">
            Go to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" replace /> : children;
};

const AdminRoute = () => {
  const { user } = useAuth();
  
  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return <AdminDashboard />;
};

const LogoutHandler = () => {
  const { logout } = useAuth();
  
  useEffect(() => {
    logout();
  }, [logout]);
  
  return <Navigate to="/login" />;
};

function AppContent() {
  return (
    <div className="App">
      <Navigation />
      <ChatBot />
      <Suspense fallback={
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      }>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          } />
          <Route path="/verify-email" element={
            <PublicRoute>
              <VerifyEmail />
            </PublicRoute>
          } />
          <Route path="/auth/callback" element={
            <PublicRoute>
              <OAuthCallback />
            </PublicRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/profile" element={
            <ProtectedRoute>
              <OnboardingWizard />
            </ProtectedRoute>
          } />
          <Route path="/browse-jobs" element={
            <ProtectedRoute>
              <BrowseJobs />
            </ProtectedRoute>
          } />
          <Route path="/browse-services" element={<BrowseServices />} />
          <Route path="/create-service" element={
            <ProtectedRoute>
              <CreateService />
            </ProtectedRoute>
          } />
          <Route path="/services/:id" element={<ServiceDetails />} />
          <Route path="/jobs/:id" element={
            <ProtectedRoute>
              <JobDetails />
            </ProtectedRoute>
          } />
          <Route path="/post-job" element={
            <ProtectedRoute>
              <PostJob />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          } />
          <Route path="/payments" element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          } />
          <Route path="/reviews" element={
            <ProtectedRoute>
              <Reviews />
            </ProtectedRoute>
          } />
          <Route path="/search" element={
            <ProtectedRoute>
              <UniversalSearch />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminRoute />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <ProjectManagement />
            </ProtectedRoute>
          } />
          <Route path="/security" element={
            <ProtectedRoute>
              <Security />
            </ProtectedRoute>
          } />
          <Route path="/disputes" element={
            <ProtectedRoute>
              <DisputeCenter />
            </ProtectedRoute>
          } />
          <Route path="/freelancers" element={<FreelancerDiscovery />} />
          <Route path="/freelancer/:username" element={<PublicProfile />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/support" element={<Support />} />
          <Route path="/" element={<Home />} />
          <Route path="/logout" element={<LogoutHandler />} />
        </Routes>
      </Suspense>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <RoleProvider>
          <MessagingProvider>
            <Router>
              <AppContent />
            </Router>
          </MessagingProvider>
        </RoleProvider>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}

export default App;
