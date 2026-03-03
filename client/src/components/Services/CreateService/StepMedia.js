import React from 'react';

const StepMedia = ({ data, onChange }) => (
  <div className="wizard-step-content">
    <h2>Media</h2>
    <p className="wizard-tip">💡 Services with images get 3x more views.</p>
    <div className="media-upload-area">
      <div className="media-dropzone">
        <span className="media-icon">📁</span>
        <p>Drag &amp; drop images here or click to browse</p>
        <p className="media-hint">PNG, JPG, GIF up to 5MB. Recommended: 1280x720px</p>
        <input
          type="file" accept="image/*" className="media-file-input"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => onChange('imagePreview', reader.result);
              reader.readAsDataURL(file);
            }
          }}
        />
      </div>
      {data.imagePreview && (
        <div className="media-preview">
          <img src={data.imagePreview} alt="Preview" />
          <button className="media-remove" onClick={() => onChange('imagePreview', '')}>×</button>
        </div>
      )}
    </div>
  </div>
);

export default StepMedia;
