import React, { useRef, useState } from 'react';

const MAX_FILES = 5;

const StepMedia = ({ data, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const gallery = data.gallery || [];

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_FILES - gallery.length;
    if (remaining <= 0) {
      setUploadError(`Maximum ${MAX_FILES} images allowed.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      toUpload.forEach((f) => formData.append('files', f));

      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const uploaded = await res.json();
      const newItems = uploaded.map((f) => ({
        url: f.url,
        caption: '',
        type: 'image',
      }));
      onChange('gallery', [...gallery, ...newItems]);
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Clear the input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleRemove = (idx) => {
    const updated = gallery.filter((_, i) => i !== idx);
    onChange('gallery', updated);
  };

  const handleCaption = (idx, caption) => {
    const updated = gallery.map((item, i) => (i === idx ? { ...item, caption } : item));
    onChange('gallery', updated);
  };

  return (
    <div className="wizard-step-content">
      <h2>Media</h2>
      <p className="wizard-tip">💡 Services with images get 3x more views.</p>

      {gallery.length < MAX_FILES && (
        <div
          className={`media-dropzone${dragOver ? ' drag-over' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Upload images"
        >
          <div className="media-dropzone-icon">📷</div>
          <p className="media-dropzone-text">
            Drag &amp; drop images here, or click to browse
          </p>
          <p className="media-dropzone-text" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
            PNG, JPG, GIF · Up to 5MB each · Max {MAX_FILES} images
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {uploading && (
        <div className="media-upload-loading">
          <span>⏳</span>
          <span>Uploading…</span>
        </div>
      )}

      {uploadError && (
        <p style={{ color: 'var(--danger, #ef4444)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          ⚠️ {uploadError}
        </p>
      )}

      {gallery.length > 0 && (
        <div className="media-thumbnails">
          {gallery.map((item, idx) => (
            <div key={idx}>
              <div className="media-thumb">
                <img src={item.url} alt={item.caption || `Image ${idx + 1}`} />
                <button
                  type="button"
                  className="media-thumb-remove"
                  onClick={() => handleRemove(idx)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
              <div className="media-thumb-caption">
                <input
                  type="text"
                  placeholder="Add a caption…"
                  value={item.caption}
                  onChange={(e) => handleCaption(idx, e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StepMedia;
