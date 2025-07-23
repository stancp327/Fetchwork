import React from 'react';
import './DisputeTimeline.css';

const DisputeTimeline = ({ dispute }) => {
  const getTimelineSteps = () => {
    const steps = [
      {
        id: 'filed',
        title: 'Dispute Filed',
        description: 'Dispute has been submitted',
        completed: true,
        date: dispute.createdAt
      },
      {
        id: 'review',
        title: 'Under Review',
        description: 'Admin is reviewing the dispute',
        completed: dispute.status === 'under_review' || dispute.status === 'resolved',
        date: dispute.status === 'under_review' || dispute.status === 'resolved' ? dispute.updatedAt : null
      },
      {
        id: 'resolved',
        title: 'Resolution Reached',
        description: 'Dispute has been resolved',
        completed: dispute.status === 'resolved',
        date: dispute.resolvedAt
      }
    ];

    return steps;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const steps = getTimelineSteps();

  return (
    <div className="dispute-timeline">
      <h3>Dispute Progress</h3>
      <div className="timeline-steps">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`timeline-step ${step.completed ? 'completed' : 'pending'}`}
          >
            <div className="timeline-indicator">
              <div className={`timeline-circle ${step.completed ? 'completed' : ''}`}>
                {step.completed ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`timeline-line ${step.completed ? 'completed' : ''}`}></div>
              )}
            </div>
            
            <div className="timeline-content">
              <div className="timeline-title">{step.title}</div>
              <div className="timeline-description">{step.description}</div>
              {step.completed && step.date && (
                <div className="timeline-date">{formatDate(step.date)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {dispute.status === 'resolved' && dispute.resolution && (
        <div className="resolution-summary">
          <h4>Resolution</h4>
          <div className="resolution-details">
            <div><strong>Outcome:</strong> {dispute.resolution.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            {dispute.resolutionAmount > 0 && (
              <div><strong>Amount:</strong> ${dispute.resolutionAmount}</div>
            )}
            {dispute.adminNotes && (
              <div><strong>Notes:</strong> {dispute.adminNotes}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeTimeline;
