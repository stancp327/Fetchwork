import React from 'react';

const PostJobStep4 = ({ formData, handleInputChange, zipLookup }) => {
  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Where is the work done?</div>

        <div className="work-type-cards">
          {[
            { value: 'remote', icon: '\ud83c\udf10', label: 'Remote', desc: 'Done online, anywhere' },
            { value: 'local', icon: '\ud83d\udccd', label: 'Local / On-site', desc: 'Freelancer comes to you' },
            { value: 'hybrid', icon: '\ud83d\udd04', label: 'Hybrid', desc: 'Mix of remote + on-site' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`work-type-card ${formData.locationType === opt.value ? 'selected' : ''}`}
              onClick={() => handleInputChange({ target: { name: 'locationType', value: opt.value } })}
            >
              <span className="work-type-icon">{opt.icon}</span>
              <span className="work-type-label">{opt.label}</span>
              <span className="work-type-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        {formData.locationType === 'remote' && (
          <div className="location-info-banner">
            {'\ud83c\udf10'} Great &mdash; freelancers worldwide can apply. No location details needed.
          </div>
        )}

        {formData.locationType !== 'remote' && (
          <>
            <p className="field-hint" style={{ marginBottom: '0.75rem' }}>
              {'\ud83d\udccd'} Let freelancers know where the work takes place so they can assess travel.
            </p>
            <div className="post-job-grid-location">
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="e.g. Concord"
                />
              </div>
              <div className="form-group">
                <label htmlFor="state">State *</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
              <div className="form-group">
                <label htmlFor="zipCode">Zip Code</label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="94520"
                  maxLength={10}
                />
                {zipLookup.loading && <span className="zip-loading">Looking up...</span>}
                {zipLookup.error && <span className="zip-error">{zipLookup.error}</span>}
                {zipLookup.result && <span className="zip-city-hint">{'\ud83d\udccd'} {zipLookup.result.city}, {zipLookup.result.state}</span>}
              </div>
            </div>
          </>
        )}
      </div>

      {formData.locationType !== 'remote' && (
        <div className="form-section">
          <div className="form-section-title">Scheduling</div>
          <div className="form-group">
            <label htmlFor="scheduledDate">When do you need them? <span className="label-optional">(optional)</span></label>
            <input
              type="datetime-local"
              id="scheduledDate"
              name="scheduledDate"
              value={formData.scheduledDate}
              onChange={handleInputChange}
              min={new Date().toISOString().slice(0, 16)}
            />
            <span className="field-hint">Leave blank if you're flexible on timing</span>
          </div>
        </div>
      )}

      <div className="post-job-checkbox">
        <input
          type="checkbox"
          id="isUrgent"
          name="isUrgent"
          checked={formData.isUrgent}
          onChange={handleInputChange}
        />
        <label htmlFor="isUrgent">{'\u26a1'} This is an urgent job</label>
      </div>

      <div className="post-job-checkbox">
        <input
          type="checkbox"
          id="recurringEnabled"
          name="recurringEnabled"
          checked={formData.recurringEnabled}
          onChange={handleInputChange}
        />
        <label htmlFor="recurringEnabled">{'\u267b\ufe0f'} Make this a recurring job</label>
      </div>

      {formData.recurringEnabled && (
        <div className="post-job-recurring">
          <div className="form-group">
            <label className="form-label">Repeat every</label>
            <select
              name="recurringInterval"
              value={formData.recurringInterval}
              onChange={handleInputChange}
              className="form-input"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">End date (optional)</label>
            <input
              type="date"
              name="recurringEndDate"
              value={formData.recurringEndDate}
              onChange={handleInputChange}
              className="form-input"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <p className="post-job-recurring-hint">
            After each job completes, a new one will be posted automatically and your previous freelancer will get first look.
          </p>
        </div>
      )}
    </>
  );
};

export default PostJobStep4;
