import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import { MessagingProvider } from './context/MessagingContext';
import Home from './components/Home/Home';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import BrowseJobs from './components/Jobs/BrowseJobs';
import PostJob from './components/Jobs/PostJob';
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

const ProtectedRoute = ({ children }) => {
  const { loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return user ? <Navigate to="/dashboard" /> : children;
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
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
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
            <AdminDashboard />
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
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <MessagingProvider>
          <Router>
            <AppContent />
          </Router>
        </MessagingProvider>
      </AdminProvider>
    </AuthProvider>
  );
}

export default App;
