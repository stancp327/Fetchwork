import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import './PortfolioWizard.css';

const STEPS = ['Basics', 'Media', 'Details', 'Review'];

const PortfolioWizard = ({ onClose, onSuccess, editItem }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(editItem || {
    title: '',
    description: '',
    mediaUrls: [],
    mediaType: 'image',
    links: [''],
    tags: [],
    tagInput: ''
  });

  const updateField = (field, value) => setItem(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    if (item.tagInput.trim() && !item.tags.includes(item.tagInput.trim())) {
      updateField('tags', [...item.tags, item.tagInput.trim()]);
      updateField('tagInput', '');
    }
  };

  const removeTag = (tag) => updateField('tags', item.tags.filter(t => t !== tag));

  const addLink = () => updateField('links', [...item.links, '']);
  const updateLink = (i, val) => {
    const links = [...item.links];
    links[i] = val;
    updateField('links', links);
  };
  const removeLink = (i) => updateField('links', item.links.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!item.title.trim()) return addToast('Title is required', 'error');
    setLoading(true);
    try {
      const payload = {
        title: item.title,
        description: item.description,
        mediaUrls: item.mediaUrls.filter(Boolean),
        mediaType: item.mediaType,
        links: item.links.filter(Boolean)
      };
      
      await apiRequest('/api/portfolio', {
        method: editItem ? 'PUT' : 'POST',
        body: JSON.stringify(editItem ? { ...payload, portfolioId: editItem._id } : payload)
      });
      addToast(editItem ? 'Portfolio item updated!' : 'Portfolio item added!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return item.title.trim().length > 0;
    return true;
  };

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pw-header">
          <h2>{editItem ? 'Edit Portfolio Item' : '✨ Add to Portfolio'}</h2>
          <button className="pw-close" onClick={onClose}>×</button>
        </div>

        {/* Step indicator */}
        <div className="pw-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`pw-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="pw-step-num">{i < step ? '✓' : i + 1}</span>
              <span className="pw-step-label">{s}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="pw-body">
          {step === 0 && (
            <div className="pw-step-content">
              <h3>What did you create?</h3>
              <div className="pw-field">
                <label>Project Title *</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder="e.g. E-commerce Website Redesign"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="pw-field">
                <label>Category</label>
                <select value={item.mediaType} onChange={e => updateField('mediaType', e.target.value)}>
                  <option value="image">🖼️ Design / Visual</option>
                  <option value="video">🎬 Video</option>
                  <option value="pdf">📄 Document / PDF</option>
                  <option value="other">🔗 Other</option>
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="pw-step-content">
              <h3>Add media & links</h3>
              <div className="pw-field">
                <label>Image/Media URLs</label>
                <p className="pw-hint">Paste URLs to images, videos, or hosted files</p>
                {item.mediaUrls.map((url, i) => (
                  <div key={i} className="pw-url-row">
                    <input
                      type="url"
                      value={url}
                      onChange={e => {
                        const urls = [...item.mediaUrls];
                        urls[i] = e.target.value;
                        updateField('mediaUrls', urls);
                      }}
                      placeholder="https://..."
                    />
                    <button type="button" className="pw-btn-icon" onClick={() => updateField('mediaUrls', item.mediaUrls.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
                <button type="button" className="pw-btn-add" onClick={() => updateField('mediaUrls', [...item.mediaUrls, ''])}>
                  + Add Media URL
                </button>
              </div>
              <div className="pw-field">
                <label>Project Links</label>
                {item.links.map((link, i) => (
                  <div key={i} className="pw-url-row">
                    <input
                      type="url"
                      value={link}
                      onChange={e => updateLink(i, e.target.value)}
                      placeholder="https://live-project.com"
                    />
                    {item.links.length > 1 && (
                      <button type="button" className="pw-btn-icon" onClick={() => removeLink(i)}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" className="pw-btn-add" onClick={addLink}>+ Add Link</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="pw-step-content">
              <h3>Tell the story</h3>
              <div className="pw-field">
                <label>Description</label>
                <textarea
                  value={item.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="What was the project about? What was your role? What tools did you use?"
                  rows={5}
                  maxLength={2000}
                />
                <span className="pw-hint">{item.description.length}/2000</span>
              </div>
              <div className="pw-field">
                <label>Tags / Skills Used</label>
                <div className="pw-tag-input">
                  <input
                    type="text"
                    value={item.tagInput || ''}
                    onChange={e => updateField('tagInput', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Type a skill and press Enter"
                  />
                </div>
                <div className="pw-tags">
                  {item.tags.map(tag => (
                    <span key={tag} className="pw-tag">{tag} <button onClick={() => removeTag(tag)}>×</button></span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="pw-step-content">
              <h3>Review & Submit</h3>
              <div className="pw-review">
                <div className="pw-review-item">
                  <strong>Title:</strong> {item.title}
                </div>
                <div className="pw-review-item">
                  <strong>Type:</strong> {item.mediaType}
                </div>
                {item.description && (
                  <div className="pw-review-item">
                    <strong>Description:</strong> {item.description.substring(0, 150)}{item.description.length > 150 ? '...' : ''}
                  </div>
                )}
                {item.mediaUrls.filter(Boolean).length > 0 && (
                  <div className="pw-review-item">
                    <strong>Media:</strong> {item.mediaUrls.filter(Boolean).length} file(s)
                  </div>
                )}
                {item.links.filter(Boolean).length > 0 && (
                  <div className="pw-review-item">
                    <strong>Links:</strong> {item.links.filter(Boolean).join(', ')}
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div className="pw-review-item">
                    <strong>Tags:</strong> {item.tags.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pw-footer">
          {step > 0 && (
            <button className="pw-btn-secondary" onClick={() => setStep(step - 1)}>← Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button className="pw-btn-primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
              Next →
            </button>
          ) : (
            <button className="pw-btn-primary" disabled={loading} onClick={handleSubmit}>
              {loading ? 'Saving...' : editItem ? 'Update' : '🚀 Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioWizard;
