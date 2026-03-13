import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/errorReporter';
import { RoleProvider } from './context/RoleContext';
import { QueryProvider } from './context/QueryProvider';
import { MessagingProvider } from './context/MessagingContext';
import { SeoProvider } from './context/SeoContext';
import { ToastProvider } from './components/common/Toast';
import usePageTracker from './hooks/usePageTracker';
// Shell components — keep critical layout in main bundle
import Navigation from './components/Navigation/Navigation';
import Footer from './components/common/Footer';
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
const EarningsDashboard    = React.lazy(() => import('./components/Profile/EarningsDashboard'));
const SkillAssessmentHub   = React.lazy(() => import('./components/Skills/SkillAssessmentHub'));

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
const MyBookings           = React.lazy(() => import('./components/Bookings/MyBookings'));
const AvailabilitySettings = React.lazy(() => import('./components/Bookings/AvailabilitySettings'));
const AvailabilityManager  = React.lazy(() => import('./components/Bookings/AvailabilityManager'));
const CalendarConnect      = React.lazy(() => import('./components/Bookings/CalendarConnect'));
const BookingDetail        = React.lazy(() => import('./components/Bookings/BookingDetail'));
const GroupSlotsPage       = React.lazy(() => import('./components/Bookings/GroupSlotsPage'));
const PricingPage          = React.lazy(() => import('./components/Billing/PricingPage'));
const BillingSettings      = React.lazy(() => import('./components/Billing/BillingSettings'));
const BillingSuccess       = React.lazy(() => import('./components/Billing/BillingSuccess'));
const WalletPage           = React.lazy(() => import('./components/Billing/WalletPage'));
const TeamsPage            = React.lazy(() => import('./components/Teams/TeamsPage'));
const TeamDetail           = React.lazy(() => import('./components/Teams/TeamDetail'));
const TeamsWorkspace       = React.lazy(() => import('./pages/Teams'));
const AgencyProfile        = React.lazy(() => import('./components/Teams/AgencyPublicProfile'));
const AgencyDirectory      = React.lazy(() => import('./components/Teams/AgencyDirectory'));
const UserAnalytics        = React.lazy(() => import('./components/Analytics/UserAnalytics'));
const SpendDashboard       = React.lazy(() => import('./components/Analytics/SpendDashboard'));
const BoostCheckout        = React.lazy(() => import('./components/Boosts/BoostCheckout'));
const BoostSuccess         = React.lazy(() => import('./components/Boosts/BoostSuccess'));
const ContractsList        = React.lazy(() => import('./components/Contracts/ContractsList'));
const ContractDetail       = React.lazy(() => import('./components/Contracts/ContractDetail'));
const CreateContract       = React.lazy(() => import('./components/Contracts/CreateContract'));
const BackgroundCheckPage  = React.lazy(() => import('./components/Verification/BackgroundCheck'));
const DiscoverySettings    = React.lazy(() => import('./components/Settings/DiscoverySettings'));
const JobAlertsPage        = React.lazy(() => import('./components/JobAlerts/JobAlertsPage'));
const ReferralPage         = React.lazy(() => import('./components/Referrals/ReferralPage'));
const PresentationView     = React.lazy(() => import('./components/Teams/PresentationView'));

// Non-critical global UI — lazy-load after initial content paint
const ChatBot              = React.lazy(() => import('./components/ChatBot/ChatBot'));
const FeedbackWidget       = React.lazy(() => import('./components/common/FeedbackWidget'));
const NotificationListener = React.lazy(() => import('./components/common/NotificationListener'));
const MessagePreview       = React.lazy(() => import('./components/common/MessagePreview'));
const IncomingCallOverlay  = React.lazy(() => import('./components/Calls/IncomingCallOverlay'));

// Defer non-critical widget mounting until browser idle to reduce initial main-thread work
const widgetMountDelay = typeof window !== 'undefined' && 'requestIdleCallback' in window
  ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
  : (fn) => setTimeout(fn, 1200);

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
    // Avoid unnecessary redirect if already on login page
    if (window.location.pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }
    return null;
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
  
  // Avoid unnecessary redirect if already on dashboard
  return user && window.location.pathname !== '/dashboard' ? <Navigate to="/dashboard" replace /> : children;
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
  const { user } = useAuth();
  const [enhancementsReady, setEnhancementsReady] = React.useState(false);

  useEffect(() => {
    const run = () => setEnhancementsReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="App">
      <ScrollToTop />
      <Navigation />
      {enhancementsReady && (
        <Suspense fallback={null}>
          <ChatBot />
          <FeedbackWidget />
          {user && <NotificationListener />}
          {user && <MessagePreview />}
          {user && <IncomingCallOverlay />}
        </Suspense>
      )}
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
          <Route path="/earnings" element={
            <ProtectedRoute>
              <EarningsDashboard />
            </ProtectedRoute>
          } />
          <Route path="/skills" element={<SkillAssessmentHub />} />
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
          <Route path="/bookings/group"        element={<ProtectedRoute><GroupSlotsPage /></ProtectedRoute>} />
          <Route path="/bookings/:id"          element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
          <Route path="/services/:id/availability" element={<ProtectedRoute><AvailabilityManager /></ProtectedRoute>} />
          <Route path="/availability"          element={<ProtectedRoute><AvailabilitySettings /></ProtectedRoute>} />
          <Route path="/calendar-connect"      element={<ProtectedRoute><CalendarConnect /></ProtectedRoute>} />
          <Route path="/pricing"               element={<PricingPage />} />
          <Route path="/billing"               element={<ProtectedRoute><BillingSettings /></ProtectedRoute>} />
          <Route path="/billing/success"       element={<ProtectedRoute><BillingSuccess /></ProtectedRoute>} />
          <Route path="/wallet"                element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
                <Route path="/teams"                 element={<ProtectedRoute><TeamsWorkspace /></ProtectedRoute>} />
                <Route path="/teams/list"            element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />
                <Route path="/teams/:id"             element={<ProtectedRoute><TeamDetail /></ProtectedRoute>} />
                <Route path="/agencies"              element={<AgencyDirectory />} />
                <Route path="/agency/:slug"          element={<AgencyProfile />} />
          <Route path="/analytics"             element={<ProtectedRoute><UserAnalytics /></ProtectedRoute>} />
          <Route path="/spend"                element={<ProtectedRoute><SpendDashboard /></ProtectedRoute>} />
              <Route path="/boost-checkout"       element={<ProtectedRoute><BoostCheckout /></ProtectedRoute>} />
              <Route path="/boost-success"        element={<ProtectedRoute><BoostSuccess /></ProtectedRoute>} />
              <Route path="/contracts"            element={<ProtectedRoute><ContractsList /></ProtectedRoute>} />
              <Route path="/contracts/new"        element={<ProtectedRoute><CreateContract /></ProtectedRoute>} />
              <Route path="/contracts/:id"        element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
              <Route path="/background-check"     element={<ProtectedRoute><BackgroundCheckPage /></ProtectedRoute>} />
          <Route path="/discovery-settings"   element={<ProtectedRoute><DiscoverySettings /></ProtectedRoute>} />
          <Route path="/job-alerts"            element={<ProtectedRoute><JobAlertsPage /></ProtectedRoute>} />
          <Route path="/referrals"             element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
          <Route path="/presentation/:slug"    element={<PresentationView />} />
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
    <QueryProvider>
    <HelmetProvider>
      <SeoProvider>
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
      </SeoProvider>
    </HelmetProvider>
    </QueryProvider>
  );
}

export default App;

