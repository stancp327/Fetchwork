import React, { useRef, useState } from 'react';

const MAX_ATTACHMENTS = 5;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PostJobStep4 = ({ formData, handleInputChange, zipLookup, setFormData }) => {
  const attachInputRef = useRef(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachError, setAttachError] = useState('');
  const [attachDragOver, setAttachDragOver] = useState(false);

  const attachments = formData.attachments || [];

  const handleAttachFiles = async (files) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setAttachError(`Maximum ${MAX_ATTACHMENTS} files allowed.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    const oversized = toUpload.filter((f) => f.size > MAX_SIZE_BYTES);
    if (oversized.length > 0) {
      setAttachError(`Some files exceed the 10 MB limit: ${oversized.map((f) => f.name).join(', ')}`);
      return;
    }
    setAttachError('');
    setAttachUploading(true);

    try {
      const fd = new FormData();
      toUpload.forEach((f) => fd.append('files', f));

      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const uploaded = await res.json();
      const newItems = uploaded.map((f) => ({
        filename: f.filename,
        url: f.url,
        size: f.size,
        contentType: f.contentType,
      }));
      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...newItems],
      }));
    } catch (err) {
      setAttachError(err.message || 'Upload failed. Please try again.');
    } finally {
      setAttachUploading(false);
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  };

  const handleAttachDrop = (e) => {
    e.preventDefault();
    setAttachDragOver(false);
    handleAttachFiles(e.dataTransfer.files);
  };

  const handleAttachRemove = (idx) => {
    setFormData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== idx),
    }));
  };

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
                {zipLookup.result && (
                  <span className="zip-city-hint">
                    {'\ud83d\udccd'} {zipLookup.result.city}, {zipLookup.result.state}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {formData.locationType !== 'remote' && (
        <div className="form-section">
          <div className="form-section-title">Scheduling</div>
          <div className="form-group">
            <label htmlFor="scheduledDate">
              When do you need them? <span className="label-optional">(optional)</span>
            </label>
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

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Preferred Days <span className="label-optional">(optional)</span></label>
            <div className="preferred-days-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <button
                  key={day}
                  type="button"
                  className={`preferred-day-btn ${(formData.preferredDays || []).includes(day) ? 'selected' : ''}`}
                  onClick={() => {
                    const current = formData.preferredDays || [];
                    const updated = current.includes(day)
                      ? current.filter(d => d !== day)
                      : [...current, day];
                    setFormData(prev => ({ ...prev, preferredDays: updated }));
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
            <span className="field-hint">Select the days that work best for you</span>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Preferred Time Window <span className="label-optional">(optional)</span></label>
            <div className="preferred-time-row">
              <select
                name="preferredTimeStart"
                value={formData.preferredTimeStart || ''}
                onChange={handleInputChange}
                className="preferred-time-select"
              >
                <option value="">Earliest</option>
                {['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
                  '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="preferred-time-sep">to</span>
              <select
                name="preferredTimeEnd"
                value={formData.preferredTimeEnd || ''}
                onChange={handleInputChange}
                className="preferred-time-select"
              >
                <option value="">Latest</option>
                {['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM',
                  '1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <span className="field-hint">Freelancers will see your preferred window and can propose times within it</span>
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

      {/* ── Attachments ─────────────────────────────────────────── */}
      <div className="form-section" style={{ marginTop: '1.5rem' }}>
        <div className="form-section-title">Attachments <span className="label-optional">(optional)</span></div>

        {attachments.length < MAX_ATTACHMENTS && (
          <div
            className={`attachment-dropzone${attachDragOver ? ' drag-over' : ''}`}
            onClick={() => !attachUploading && attachInputRef.current?.click()}
            onDrop={handleAttachDrop}
            onDragOver={(e) => { e.preventDefault(); setAttachDragOver(true); }}
            onDragLeave={() => setAttachDragOver(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && attachInputRef.current?.click()}
            aria-label="Upload attachments"
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📎</div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary, #6b7280)' }}>
              Drag &amp; drop files here, or click to browse
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
              JPG, PNG, GIF, PDF, DOC, DOCX · Up to 10 MB each · Max {MAX_ATTACHMENTS} files
            </p>
            <input
              ref={attachInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleAttachFiles(e.target.files)}
            />
          </div>
        )}

        {attachUploading && (
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem' }}>
            ⏳ Uploading…
          </p>
        )}

        {attachError && (
          <p style={{ marginTop: '0.5rem', color: 'var(--danger, #ef4444)', fontSize: '0.9rem' }}>
            ⚠️ {attachError}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="attachment-list">
            {attachments.map((item, idx) => (
              <div key={idx} className="attachment-item">
                <div className="attachment-item-info">
                  <span>📄</span>
                  <span>{item.filename}</span>
                  <span className="attachment-item-size">{humanSize(item.size)}</span>
                </div>
                <button
                  type="button"
                  className="attachment-item-remove"
                  onClick={() => handleAttachRemove(idx)}
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default PostJobStep4;
