import React, { useState } from 'react';
import axios from 'axios';
import FileUpload from '../common/FileUpload';
import './DisputeFilingForm.css';
import { getApiBaseUrl } from '../../utils/api';

const DisputeFilingForm = ({ jobId, onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [disputeData, setDisputeData] = useState({
    reason: '',
    description: '',
    evidence: []
  });
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [loading, setLoading] = useState(false);

  const reasons = [
    { value: 'non_delivery', label: 'Work was not delivered' },
    { value: 'quality_issues', label: 'Quality does not match description' },
    { value: 'missed_deadline', label: 'Deadline was missed' },
    { value: 'payment_fraud', label: 'Payment fraud or issues' },
    { value: 'abusive_communication', label: 'Abusive or inappropriate communication' },
    { value: 'other', label: 'Other reason' }
  ];

  const steps = [
    { number: 1, title: 'Select Reason', key: 'reason' },
    { number: 2, title: 'Provide Details', key: 'details' },
    { number: 3, title: 'Review & Submit', key: 'review' }
  ];

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return disputeData.reason !== '';
      case 2:
        return disputeData.description.trim().length >= 50;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!isStepValid(2)) return;
    
    setLoading(true);
    try {
      const API_BASE_URL = getApiBaseUrl();
      
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('reason', disputeData.reason);
      formData.append('description', disputeData.description);
      
      selectedEvidence.forEach(file => {
        formData.append('evidence', file);
      });

      const response = await axios.post(`${API_BASE_URL}/api/disputes`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      onSubmit(response.data.dispute);
      onClose();
    } catch (error) {
      console.error('Error filing dispute:', error);
      alert('Failed to file dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-dispute-overlay">
      <div className="modal-dispute-wrapper">
        <div className="modal-header">
          <h2>File a Dispute</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="step-indicator">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`step-item ${currentStep >= step.number ? 'active' : ''} ${currentStep === step.number ? 'current' : ''}`}
            >
              <div className="step-number">{step.number}</div>
              <div className="step-title">{step.title}</div>
            </div>
          ))}
        </div>

        <div className="modal-body">
          {currentStep === 1 && (
            <div className="step-content">
              <h3>What is the reason for this dispute?</h3>
              <div className="reason-options">
                {reasons.map((reason) => (
                  <label key={reason.value} className="reason-option">
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      checked={disputeData.reason === reason.value}
                      onChange={(e) => setDisputeData({...disputeData, reason: e.target.value})}
                    />
                    <span className="reason-label">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h3>Provide detailed information</h3>
              <p className="step-description">
                Please provide a detailed description of the issue. Include specific examples and any relevant information.
              </p>
              <textarea
                className="dispute-description"
                placeholder="Describe the issue in detail (minimum 50 characters)..."
                value={disputeData.description}
                onChange={(e) => setDisputeData({...disputeData, description: e.target.value})}
                rows={6}
              />
              <div className="char-count">
                {disputeData.description.length}/2000 characters
                {disputeData.description.length < 50 && (
                  <span className="char-warning"> (minimum 50 required)</span>
                )}
              </div>

              <div className="form-group">
                <label>Evidence (Optional)</label>
                <FileUpload
                  onFileSelect={setSelectedEvidence}
                  accept=".pdf,.doc,.docx,.txt,image/*"
                  maxSize={10 * 1024 * 1024}
                  multiple={true}
                  label="Upload Supporting Documents"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h3>Review your dispute</h3>
              <div className="dispute-summary">
                <div className="summary-item">
                  <strong>Reason:</strong>
                  <span>{reasons.find(r => r.value === disputeData.reason)?.label}</span>
                </div>
                <div className="summary-item">
                  <strong>Description:</strong>
                  <p>{disputeData.description}</p>
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
                disabled={loading || !isStepValid(2)}
              >
                {loading ? 'Filing Dispute...' : 'File Dispute'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputeFilingForm;
