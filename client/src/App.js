import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import { AdminProvider } from './context/AdminContext';
import { MessagingProvider } from './context/MessagingContext';
import Home from './components/Home/Home';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import BrowseJobs from './components/Jobs/BrowseJobs';
import BrowseServices from './components/Services/BrowseServices';
import CreateService from './components/Services/CreateService';
import ServiceDetails from './components/Services/ServiceDetails';
import PostJob from './components/Jobs/PostJob';
import JobDetails from './components/Jobs/JobDetails';
import Profile from './components/Profile/Profile';
import Messages from './components/Messages/Messages';
import Payments from './components/Payments/Payments';
import Reviews from './components/Reviews/Reviews';
import UniversalSearch from './components/Search/UniversalSearch';
import AdminDashboard from './components/Admin/AdminDashboard';
import ProjectManagement from './components/Projects/ProjectManagement';
import Security from './components/Security/Security';
import ChatBot from './components/ChatBot/ChatBot';
import Navigation from './components/Navigation/Navigation';
import './App.css';

class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    console.error('❌ AuthErrorBoundary caught error:', error);
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Authentication error occurred. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  console.log('🔍 ProtectedRoute - user:', user, 'loading:', loading, 'token:', localStorage.getItem('token') ? 'present' : 'missing');
  
  if (loading) {
    console.log('🔍 ProtectedRoute - showing loading state');
    return <div className="loading">Loading...</div>;
  }
  
  if (!user) {
    console.log('🔍 ProtectedRoute - no user, redirecting to login');
    return <Navigate to="/login" />;
  }
  
  console.log('🔍 ProtectedRoute - user authenticated, rendering protected content');
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return user ? <Navigate to="/dashboard" /> : children;
};

const AdminRoute = () => {
  const { user } = useAuth();
  
  console.log('AdminRoute - user:', user, 'isAdmin:', user?.isAdmin);
  
  if (!user?.isAdmin) {
    console.log('AdminRoute - user not admin, redirecting to dashboard');
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
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
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
        <Route path="/" element={<Home />} />
        <Route path="/logout" element={<LogoutHandler />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <RoleProvider>
          <AdminProvider>
            <MessagingProvider>
              <Router>
                <AppContent />
              </Router>
            </MessagingProvider>
          </AdminProvider>
        </RoleProvider>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}

export default App;
