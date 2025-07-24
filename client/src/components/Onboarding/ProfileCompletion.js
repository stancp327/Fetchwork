import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import './ProfileCompletion.css';

const ProfileCompletion = ({ showInDashboard = false }) => {
  const { user } = useAuth();
  const [completionData, setCompletionData] = useState({
    percentage: 0,
    completedSteps: [],
    totalSteps: 5
  });

  const steps = useMemo(() => [
    { id: 'bio', label: 'Write your bio', field: 'bio' },
    { id: 'skills', label: 'Add your skills', field: 'skills' },
    { id: 'hourlyRate', label: 'Set your hourly rate', field: 'hourlyRate' },
    { id: 'phone', label: 'Verify your phone', field: 'phone' },
    { id: 'photo', label: 'Upload a photo', field: 'profilePicture' }
  ], []);

  useEffect(() => {
    if (user) {
      const completed = steps.filter(step => {
        const fieldValue = user[step.field];
        if (step.id === 'skills') {
          return fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0;
        }
        return fieldValue && fieldValue.toString().trim() !== '';
      });

      setCompletionData({
        percentage: Math.round((completed.length / steps.length) * 100),
        completedSteps: completed.map(step => step.id),
        totalSteps: steps.length
      });
    }
  }, [user, steps]);

  if (!user || completionData.percentage === 100) {
    return null;
  }

  if (showInDashboard && completionData.percentage > 80) {
    return null;
  }

  return (
    <div className="completion-progress-wrapper">
      <div className="completion-header">
        <div className="user-info">
          <div className="user-avatar">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt={user.name} />
            ) : (
              <div className="avatar-placeholder">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>
          <div className="user-details">
            <h3>{user.name || 'User'}</h3>
            <p className="user-role">{user.role === 'freelancer' ? 'Freelancer' : 'Client'}</p>
          </div>
        </div>
      </div>

      <div className="completion-progress">
        <div className="progress-header">
          <span className="progress-label">Profile complete {completionData.percentage}%</span>
        </div>
        <div className="completion-bar">
          <div 
            className="completion-fill" 
            style={{ width: `${completionData.percentage}%` }}
          ></div>
        </div>
      </div>

      <div className="completion-steps">
        {steps.map(step => (
          <div 
            key={step.id} 
            className={`completion-step ${completionData.completedSteps.includes(step.id) ? 'completed' : ''}`}
          >
            <div className="step-icon">
              {completionData.completedSteps.includes(step.id) ? '✓' : '○'}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>

      <div className="completion-actions">
        <Link to="/profile" className="edit-profile-btn">
          Edit Profile
        </Link>
      </div>
    </div>
  );
};

export default ProfileCompletion;
