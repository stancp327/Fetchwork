import React, { useState, useEffect, useRef } from 'react';
import { CATEGORIES } from '../../utils/categories';
import './CategoryCombobox.css';

const KNOWN_IDS = new Set(CATEGORIES.map(c => c.id));

const REMOTE_CATS = CATEGORIES.filter(c => c.type === 'remote' || c.type === 'both');
const LOCAL_CATS  = CATEGORIES.filter(c => c.type === 'local'  || c.type === 'both');

/**
 * CategoryCombobox
 * Props:
 *   value      — current value (category id or custom string)
 *   onChange   — (value: string) => void
 *   placeholder — string
 *   required   — bool
 *   name       — string (for native form association)
 */
const CategoryCombobox = ({ value = '', onChange, placeholder = 'Select a category', required = false, name }) => {
  // Is the current value a custom (non-predefined) string?
  const isCustom = value && !KNOWN_IDS.has(value);

  const [mode,       setMode]       = useState(isCustom ? 'custom' : 'select');
  const [customText, setCustomText] = useState(isCustom ? value : '');
  const inputRef = useRef(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!value) {
      setMode('select');
      setCustomText('');
    } else if (!KNOWN_IDS.has(value)) {
      setMode('custom');
      setCustomText(value);
    } else {
      setMode('select');
      setCustomText('');
    }
  }, [value]);

  // Focus text input when switching to custom mode
  useEffect(() => {
    if (mode === 'custom' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setMode('custom');
      setCustomText('');
      onChange('');
    } else {
      onChange(val);
    }
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomText(val);
    onChange(val);
  };

  const handleBackToSelect = () => {
    setMode('select');
    setCustomText('');
    onChange('');
  };

  if (mode === 'custom') {
    return (
      <div className="cat-combo">
        <div className="cat-combo-custom">
          <input
            ref={inputRef}
            type="text"
            className="cat-combo-input"
            value={customText}
            onChange={handleCustomChange}
            placeholder="e.g. Wedding Photography, Dog Training..."
            maxLength={100}
            required={required}
            name={name}
          />
          <button type="button" className="cat-combo-back" onClick={handleBackToSelect} title="Back to list">
            ← List
          </button>
        </div>
        <p className="cat-combo-hint">
          ✏️ Type your own category. It will be reviewed and may be added to the official list.
        </p>
      </div>
    );
  }

  return (
    <div className="cat-combo">
      <select
        className="cat-combo-select"
        value={value || ''}
        onChange={handleSelectChange}
        required={required}
        name={name}
      >
        <option value="">{placeholder}</option>

        <optgroup label="── Remote / Online ──────────">
          {REMOTE_CATS.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </optgroup>

        <optgroup label="── Local / In-Person ─────────">
          {LOCAL_CATS.filter(c => c.type === 'local').map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </optgroup>

        <optgroup label="─────────────────────────────">
          <option value="__custom__">✏️ Type your own category...</option>
        </optgroup>
      </select>
    </div>
  );
};

export default CategoryCombobox;
