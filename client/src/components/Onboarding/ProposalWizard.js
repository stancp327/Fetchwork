import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './ProposalWizard.css';

const ProposalWizard = ({ jobId, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [proposalData, setProposalData] = useState({
    coverLetter: '',
    hourlyRate: user?.hourlyRate || '',
    estimatedHours: '',
    timeline: '',
    attachments: []
  });

  const steps = [
    { number: 1, title: 'Proposal Details', key: 'proposal' },
    { number: 2, title: 'Scope & Timing', key: 'scope' },
    { number: 3, title: 'Review', key: 'review' }
  ];

  const handleInputChange = (field, value) => {
    setProposalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit(proposalData);
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return proposalData.coverLetter.trim().length > 50;
      case 2:
        return proposalData.hourlyRate && proposalData.estimatedHours && proposalData.timeline;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="modal-proposal-overlay">
      <div className="modal-proposal-wrapper">
        <div className="modal-header">
          <h2>Submit a Proposal</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="step-indicator">
          {steps.map(step => (
            <div 
              key={step.number}
              className={`step-item ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
            >
              <div className="step-number">
                {currentStep > step.number ? '✓' : step.number}
              </div>
              <span className="step-title">{step.title}</span>
            </div>
          ))}
        </div>

        <div className="modal-body">
          {currentStep === 1 && (
            <div className="step-content">
              <h3>Type a cover letter</h3>
              <p className="step-description">
                Please describe why you're the perfect freelancer for this job.
              </p>
              <textarea
                className="cover-letter-input"
                placeholder="Please describe why you're the perfect freelancer for this job."
                value={proposalData.coverLetter}
                onChange={(e) => handleInputChange('coverLetter', e.target.value)}
                rows={6}
              />
              <div className="character-count">
                {proposalData.coverLetter.length} characters (minimum 50)
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h3>Set your rate and timeline</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Hourly Rate ($)</label>
                  <input
                    type="number"
                    placeholder="70.00"
                    value={proposalData.hourlyRate}
                    onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Estimated Hours</label>
                  <input
                    type="number"
                    placeholder="40"
                    value={proposalData.estimatedHours}
                    onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Project Timeline</label>
                  <select
                    value={proposalData.timeline}
                    onChange={(e) => handleInputChange('timeline', e.target.value)}
                  >
                    <option value="">Select timeline</option>
                    <option value="1-3 days">1-3 days</option>
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="2+ months">2+ months</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h3>Review your proposal</h3>
              <div className="proposal-summary">
                <div className="summary-section">
                  <h4>Cover Letter</h4>
                  <p className="summary-text">{proposalData.coverLetter}</p>
                </div>
                <div className="summary-section">
                  <h4>Rate & Timeline</h4>
                  <div className="summary-details">
                    <span><strong>Hourly Rate:</strong> ${proposalData.hourlyRate}</span>
                    <span><strong>Estimated Hours:</strong> {proposalData.estimatedHours}</span>
                    <span><strong>Timeline:</strong> {proposalData.timeline}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-buttons">
            {currentStep > 1 && (
              <button className="btn-secondary" onClick={handlePrevious}>
                Previous
              </button>
            )}
            {currentStep < 3 ? (
              <button 
                className="btn-primary" 
                onClick={handleNext}
                disabled={!isStepValid(currentStep)}
              >
                Next
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={!isStepValid(currentStep)}
              >
                Submit Proposal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalWizard;
