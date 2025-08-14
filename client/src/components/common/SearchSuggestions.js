import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/api';

const SearchSuggestions = ({ value, onSelect, placeholder = "Search..." }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`${apiBaseUrl}/api/search/suggestions?q=${encodeURIComponent(value)}`);
        setSuggestions(response.data.suggestions);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, apiBaseUrl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion) => {
    onSelect(suggestion.text);
    setShowSuggestions(false);
  };

  return (
    <div className="search-suggestions" ref={suggestionsRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        className="search-input"
      />
      
      {showSuggestions && (suggestions.length > 0 || loading) && (
        <div className="suggestions-dropdown">
          {loading ? (
            <div className="suggestion-item loading">Loading suggestions...</div>
          ) : (
            suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <span className="suggestion-text">{suggestion.text}</span>
                <span className="suggestion-type">{suggestion.type}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
