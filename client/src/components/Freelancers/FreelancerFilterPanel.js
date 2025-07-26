import React from 'react';

const FreelancerFilterPanel = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key, value) => {
    onFilterChange(key, value);
  };

  return (
    <div className="filters">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search freelancers by name, skills, or bio..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Skills</label>
        <input
          type="text"
          placeholder="e.g. React, Node.js, Design"
          value={filters.skills}
          onChange={(e) => handleFilterChange('skills', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Location</label>
        <input
          type="text"
          placeholder="Enter location"
          value={filters.location}
          onChange={(e) => handleFilterChange('location', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Min Hourly Rate</label>
        <input
          type="number"
          placeholder="$0"
          value={filters.minRate}
          onChange={(e) => handleFilterChange('minRate', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Max Hourly Rate</label>
        <input
          type="number"
          placeholder="No limit"
          value={filters.maxRate}
          onChange={(e) => handleFilterChange('maxRate', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Minimum Rating</label>
        <select
          value={filters.rating}
          onChange={(e) => handleFilterChange('rating', e.target.value)}
        >
          <option value="all">Any Rating</option>
          <option value="4">4+ Stars</option>
          <option value="3">3+ Stars</option>
          <option value="2">2+ Stars</option>
          <option value="1">1+ Stars</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Sort By</label>
        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        >
          <option value="rating">Highest Rated</option>
          <option value="rate_low">Lowest Rate</option>
          <option value="rate_high">Highest Rate</option>
          <option value="experience">Most Experience</option>
          <option value="earnings">Top Earners</option>
          <option value="newest">Newest Members</option>
        </select>
      </div>
    </div>
  );
};

export default FreelancerFilterPanel;
