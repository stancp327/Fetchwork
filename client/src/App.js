import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/errorReporter';
import { RoleProvider } from './context/RoleContext';
import { MessagingProvider } from './context/MessagingContext';
import { ToastProvider } from './components/common/Toast';
import usePageTracker from './hooks/usePageTracker';
// Shell components — always rendered, must stay in main bundle
import Navigation from './components/Navigation/Navigation';
import Footer from './components/common/Footer';
import ChatBot from './components/ChatBot/ChatBot';
import NotificationListener from './components/common/NotificationListener';
import MessagePreview from './components/common/MessagePreview';
import './App.css';

// Route components — lazy-loaded, only downloaded when the route is visited
const Home         = React.lazy(() => import('./components/Home/Home'));
const Login        = React.lazy(() => import('./components/Auth/Login'));
const Register     = React.lazy(() => import('./components/Auth/Register'));
const ForgotPassword = React.lazy(() => import('./components/Auth/ForgotPassword'));
const ResetPassword  = React.lazy(() => import('./components/Auth/ResetPassword'));
const VerifyEmail    = React.lazy(() => import('./components/Auth/VerifyEmail'));
const OAuthCallback  = React.lazy(() => import('./components/Auth/OAuthCallback'));
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
const AdminDisputeDetail = React.lazy(() => import('./components/Admin/AdminDisputeDetail'));
const ProjectManagement = React.lazy(() => import('./components/Projects/ProjectManagement'));
const MyOffers = React.lazy(() => import('./components/Offers/MyOffers'));
const JobProgress = React.lazy(() => import('./components/Jobs/JobProgress'));
const JobProposals = React.lazy(() => import('./components/Jobs/JobProposals'));
const ServiceOrderProgress = React.lazy(() => import('./components/Services/ServiceOrderProgress'));
const SavedItems = React.lazy(() => import('./components/Saved/SavedItems'));
const Security = React.lazy(() => import('./components/Security/Security'));
const DisputeCenter = React.lazy(() => import('./components/Disputes/DisputeCenter'));
const OnboardingWizard = React.lazy(() => import('./components/Onboarding/ProfileWizard/Wizard'));

const ContactUs = React.lazy(() => import('./components/common/ContactUs'));
const Support = React.lazy(() => import('./components/common/Support'));
const CategoryLanding      = React.lazy(() => import('./components/Categories/CategoryLanding'));
const MyBookings           = React.lazy(() => import('./components/Booking/MyBookings'));
const AvailabilitySettings = React.lazy(() => import('./components/Booking/AvailabilitySettings'));
const CalendarConnect      = React.lazy(() => import('./components/Booking/CalendarConnect'));
const PricingPage          = React.lazy(() => import('./components/Billing/PricingPage'));
const BillingSettings      = React.lazy(() => import('./components/Billing/BillingSettings'));
const BillingSuccess       = React.lazy(() => import('./components/Billing/BillingSuccess'));
const WalletPage           = React.lazy(() => import('./components/Billing/WalletPage'));
const UserAnalytics        = React.lazy(() => import('./components/Analytics/UserAnalytics'));
const JobAlertsPage        = React.lazy(() => import('./components/JobAlerts/JobAlertsPage'));
const ReferralPage         = React.lazy(() => import('./components/Referrals/ReferralPage'));

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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppContent() {
  usePageTracker();
  return (
    <div className="App">
      <ScrollToTop />
      <Navigation />
      <ChatBot />
      <NotificationListener />
      <MessagePreview />
      <main className="page-content">
      <Suspense fallback={
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      }>
        <RouteErrorBoundary>
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
          <Route path="/browse-jobs" element={<BrowseJobs />} />
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
          <Route path="/jobs/:id/proposals" element={
            <ProtectedRoute>
              <JobProposals />
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
          <Route path="/admin/disputes/:id" element={
            <ProtectedRoute>
              <AdminDisputeDetail />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <ProjectManagement />
            </ProtectedRoute>
          } />
          <Route path="/jobs/:id/progress" element={
            <ProtectedRoute>
              <JobProgress />
            </ProtectedRoute>
          } />
          <Route path="/services/:serviceId/orders/:orderId" element={
            <ProtectedRoute>
              <ServiceOrderProgress />
            </ProtectedRoute>
          } />
          <Route path="/saved" element={
            <ProtectedRoute>
              <SavedItems />
            </ProtectedRoute>
          } />
          <Route path="/offers" element={
            <ProtectedRoute>
              <MyOffers />
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
          <Route path="/freelancers/:id" element={<PublicProfile />} />
          <Route path="/freelancer/:username" element={<PublicProfile />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/support" element={<Support />} />
          <Route path="/categories/:categoryId" element={<CategoryLanding />} />
          <Route path="/bookings"              element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/availability"          element={<ProtectedRoute><AvailabilitySettings /></ProtectedRoute>} />
          <Route path="/calendar-connect"      element={<ProtectedRoute><CalendarConnect /></ProtectedRoute>} />
          <Route path="/pricing"               element={<PricingPage />} />
          <Route path="/billing"               element={<ProtectedRoute><BillingSettings /></ProtectedRoute>} />
          <Route path="/billing/success"       element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
          <Route path="/wallet"                element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/analytics"             element={<ProtectedRoute><UserAnalytics /></ProtectedRoute>} />
          <Route path="/job-alerts"            element={<ProtectedRoute><JobAlertsPage /></ProtectedRoute>} />
          <Route path="/referrals"             element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
          <Route path="/" element={<Home />} />
          <Route path="/logout" element={<LogoutHandler />} />
        </Routes>
        </RouteErrorBoundary>
      </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    <HelmetProvider>
      <AppErrorBoundary>
        <AuthErrorBoundary>
          <AuthProvider>
            <RoleProvider>
              <MessagingProvider>
                <ToastProvider>
                  <Router>
                    <AppContent />
                  </Router>
                </ToastProvider>
              </MessagingProvider>
            </RoleProvider>
          </AuthProvider>
        </AuthErrorBoundary>
      </AppErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
