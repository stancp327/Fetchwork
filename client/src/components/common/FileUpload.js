import React, { useState, useRef } from 'react';
import './FileUpload.css';

const FileUpload = ({ 
  onFileSelect, 
  accept = "image/*", 
  maxSize = 5 * 1024 * 1024,
  multiple = false,
  label = "Choose File",
  preview = false,
  currentFile = null
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(currentFile);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
    }
    return null;
  };

  const handleFiles = (files) => {
    setError('');
    const fileArray = Array.from(files);
    
    if (!multiple && fileArray.length > 1) {
      setError('Please select only one file');
      return;
    }

    const validFiles = [];
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      validFiles.push(file);
    }

    if (preview && validFiles[0] && validFiles[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(validFiles[0]);
    }

    onFileSelect(multiple ? validFiles : validFiles[0]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        {preview && previewUrl ? (
          <div className="file-preview">
            <img src={previewUrl} alt="Preview" className="preview-image" />
            <div className="preview-overlay">
              <span>Click to change</span>
            </div>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <p className="upload-text">
              Drag and drop files here, or <span className="upload-link">click to browse</span>
            </p>
            <p className="upload-hint">
              {accept.includes('image') ? 'Images only' : 'Documents and images'} • 
              Max {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        )}
      </div>
      
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default FileUpload;
