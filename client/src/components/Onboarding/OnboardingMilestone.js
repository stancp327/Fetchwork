import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import './OnboardingMilestone.css';

const OnboardingMilestone = ({ showInDashboard = false }) => {
  const { user, isAuthenticated } = useAuth();
  const [milestones, setMilestones] = useState([]);

  const baseMilestones = useMemo(() => [
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
  ], []);

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
    <div className="om-milestone-tracker">
      <div className="om-milestone-header">
        <h3>Let's get started!</h3>
        <p>Complete these steps to make the most of FetchWork.</p>
        <div className="om-milestone-progress">
          <span className="om-progress-text">{completedCount} of {totalCount} completed</span>
        </div>
      </div>

      <div className="om-milestone-list">
        {milestones.map((milestone, index) => (
          <div 
            key={milestone.id}
            className={`om-milestone-item ${milestone.completed ? 'completed' : ''}`}
          >
            <div className="om-milestone-indicator">
              <div className={`om-milestone-circle ${milestone.completed ? 'completed' : ''}`}>
                {milestone.completed ? '✓' : index + 1}
              </div>
              {index < milestones.length - 1 && (
                <div className={`om-milestone-line ${milestone.completed ? 'completed' : ''}`}></div>
              )}
            </div>
            
            <div className="om-milestone-content">
              <div className="om-milestone-title">{milestone.title}</div>
              <div className="om-milestone-description">{milestone.description}</div>
              {milestone.completed && milestone.completedDate && (
                <div className="om-milestone-date">{formatDate(milestone.completedDate)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {completedCount < totalCount && (
        <div className="om-milestone-actions">
          <button className="om-milestone-cta">
            {completedCount === 0 ? 'Get Started' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingMilestone;
