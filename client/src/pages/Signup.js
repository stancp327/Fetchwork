import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/auth.css';

function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleUserTypeSelect = (type) => {
    setUserType(type);
    setStep(2);
  };

  const validateStep2 = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateStep2()) {
      setIsLoading(true);
      
      try {
        const response = await authService.signup({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          userType: userType
        });
        
        if (response.token) {
          navigate('/dashboard');
        } else {
          setErrors({ general: response.message || 'Signup failed' });
        }
      } catch (error) {
        setErrors({ general: 'Signup failed. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const UserTypeSelection = () => (
    <div className="user-type-selection">
      <div className="auth-header">
        <h1>Join FetchWork</h1>
        <p>Choose how you want to use FetchWork</p>
      </div>

      <div className="user-type-options">
        <div 
          className="user-type-card card"
          onClick={() => handleUserTypeSelect('client')}
        >
          <div className="user-type-icon">💼</div>
          <h3>I'm a Client</h3>
          <p>I want to hire freelancers for my projects</p>
          <ul>
            <li>Post jobs and projects</li>
            <li>Browse freelancer profiles</li>
            <li>Manage project payments</li>
            <li>Access client dashboard</li>
          </ul>
          <button className="btn">Join as Client</button>
        </div>

        <div 
          className="user-type-card card"
          onClick={() => handleUserTypeSelect('freelancer')}
        >
          <div className="user-type-icon">🎯</div>
          <h3>I'm a Freelancer</h3>
          <p>I want to offer my services and find work</p>
          <ul>
            <li>Create service listings</li>
            <li>Apply to job postings</li>
            <li>Build your portfolio</li>
            <li>Earn money from your skills</li>
          </ul>
          <button className="btn">Join as Freelancer</button>
        </div>
      </div>

      <div className="auth-footer">
        <p>
          Already have an account? 
          <Link to="/login" className="auth-link"> Sign in</Link>
        </p>
      </div>
    </div>
  );

  const SignupForm = () => (
    <div className="signup-form-container">
      <div className="auth-header">
        <button 
          className="back-btn"
          onClick={() => setStep(1)}
        >
          ← Back
        </button>
        <h1>Create Your Account</h1>
        <p>Sign up as a {userType}</p>
      </div>

      {errors.general && (
        <div className="error-banner">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-grid grid grid-2">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="Enter your first name"
              className={errors.firstName ? 'error' : ''}
              disabled={isLoading}
            />
            {errors.firstName && <span className="error-message">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Enter your last name"
              className={errors.lastName ? 'error' : ''}
              disabled={isLoading}
            />
            {errors.lastName && <span className="error-message">{errors.lastName}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email"
            className={errors.email ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Create a password (min 8 characters)"
            className={errors.password ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Confirm your password"
            className={errors.confirmPassword ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
              disabled={isLoading}
              className={errors.agreeToTerms ? 'error' : ''}
            />
            I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
          </label>
          {errors.agreeToTerms && <span className="error-message">{errors.agreeToTerms}</span>}
        </div>

        <button 
          type="submit" 
          className="btn auth-btn"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-footer">
        <p>
          Already have an account? 
          <Link to="/login" className="auth-link"> Sign in</Link>
        </p>
      </div>
    </div>
  );

  return (
    <div className="signup-page">
      <div className="auth-container">
        <div className="auth-card card">
          {step === 1 ? <UserTypeSelection /> : <SignupForm />}
        </div>
      </div>
    </div>
  );
}

export default Signup;
