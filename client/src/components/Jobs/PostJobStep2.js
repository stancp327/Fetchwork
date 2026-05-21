import React from 'react';

const PostJobStep2 = ({ formData, handleInputChange, errors, userTeams, selectedTeam, setSelectedTeam }) => {
  return (
    <div className="form-section">
      <div className="form-section-title">Project Details</div>

      <div className="form-group">
        <label htmlFor="experienceLevel">Experience Level *</label>
        <select
          id="experienceLevel"
          name="experienceLevel"
          value={formData.experienceLevel}
          onChange={handleInputChange}
        >
          <option value="">Select experience level</option>
          <option value="entry">Entry Level</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
        {errors.experienceLevel && <div className="error-text">{errors.experienceLevel}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="duration">Project Duration *</label>
        <select
          id="duration"
          name="duration"
          value={formData.duration}
          onChange={handleInputChange}
        >
          <option value="">Select duration</option>
          <option value="less_than_1_week">Less than 1 week</option>
          <option value="1_2_weeks">1-2 weeks</option>
          <option value="1_month">1 month</option>
          <option value="2_3_months">2-3 months</option>
          <option value="3_6_months">3-6 months</option>
          <option value="more_than_6_months">More than 6 months</option>
        </select>
        {errors.duration && <div className="error-text">{errors.duration}</div>}
      </div>

      <div className="form-group">
        <label>Project Type</label>
        <div className="pj-type-cards">
          {[
            { value: 'one_time', label: 'One-time', desc: 'Fixed project with clear deliverables' },
            { value: 'ongoing', label: 'Ongoing', desc: 'Continuous work, no fixed end date' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`pj-type-card ${formData.projectType === opt.value ? 'selected' : ''}`}
              onClick={() => handleInputChange({ target: { name: 'projectType', value: opt.value } })}
            >
              <span className="pj-type-label">{opt.label}</span>
              <span className="pj-type-desc">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {userTeams.length > 0 && (
        <div className="form-group">
          <label htmlFor="teamId">Post on behalf of a team (optional)</label>
          <select
            id="teamId"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">Personal (no team)</option>
            {userTeams.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
          {selectedTeam && (
            <span className="field-hint">
              This job will be linked to your team. It may require approval if team settings are enabled.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PostJobStep2;
