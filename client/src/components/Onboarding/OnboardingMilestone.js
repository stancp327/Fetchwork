import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './OnboardingMilestone.css';

const OnboardingMilestone = ({ showInDashboard = false }) => {
  const { user, isAuthenticated } = useAuth();
  const [milestones, setMilestones] = useState([]);

  const baseMilestones = [
    {
      id: 'signup',
      title: 'Sign up for FetchWork',
      description: 'Create your account',
      completed: false,
      completedDate: null,
      order: 1
    },
    {
      id: 'profile',
      title: 'Create your profile',
      description: 'Add your basic information',
      completed: false,
      completedDate: null,
      order: 2
    },
    {
      id: 'first_proposal',
      title: 'Send a proposal',
      description: 'Apply to your first job',
      completed: false,
      completedDate: null,
      order: 3
    }
  ];

  useEffect(() => {
    if (user && isAuthenticated) {
      const updatedMilestones = baseMilestones.map(milestone => {
        let completed = false;
        let completedDate = null;

        switch (milestone.id) {
          case 'signup':
            completed = true;
            completedDate = user.createdAt || new Date().toISOString();
            break;
          case 'profile':
            const hasBasicProfile = user.name && user.email && (user.bio || user.hourlyRate);
            completed = hasBasicProfile;
            completedDate = completed ? user.updatedAt : null;
            break;
          case 'first_proposal':
            completed = false;
            break;
          default:
            break;
        }

        return {
          ...milestone,
          completed,
          completedDate
        };
      });

      setMilestones(updatedMilestones);
    }
  }, [user, isAuthenticated, baseMilestones]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const completedCount = milestones.filter(m => m.completed).length;
  const totalCount = milestones.length;

  if (showInDashboard && completedCount === totalCount) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="milestone-tracker">
      <div className="milestone-header">
        <h3>Let's get started!</h3>
        <p>Complete these steps to make the most of FetchWork.</p>
        <div className="milestone-progress">
          <span className="progress-text">{completedCount} of {totalCount} completed</span>
        </div>
      </div>

      <div className="milestone-list">
        {milestones.map((milestone, index) => (
          <div 
            key={milestone.id}
            className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
          >
            <div className="milestone-indicator">
              <div className={`milestone-circle ${milestone.completed ? 'completed' : ''}`}>
                {milestone.completed ? '✓' : index + 1}
              </div>
              {index < milestones.length - 1 && (
                <div className={`milestone-line ${milestone.completed ? 'completed' : ''}`}></div>
              )}
            </div>
            
            <div className="milestone-content">
              <div className="milestone-title">{milestone.title}</div>
              <div className="milestone-description">{milestone.description}</div>
              {milestone.completed && milestone.completedDate && (
                <div className="milestone-date">{formatDate(milestone.completedDate)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {completedCount < totalCount && (
        <div className="milestone-actions">
          <button className="milestone-cta">
            {completedCount === 0 ? 'Get Started' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingMilestone;
