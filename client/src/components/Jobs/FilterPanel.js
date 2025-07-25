import React from 'react';

const FilterPanel = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key, value) => {
    onFilterChange(key, value);
  };

  return (
    <div className="filters">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search jobs, skills, or keywords..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Category</label>
        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="web_development">Web Development</option>
          <option value="mobile_development">Mobile Development</option>
          <option value="design">Design</option>
          <option value="writing">Writing</option>
          <option value="marketing">Marketing</option>
          <option value="data_entry">Data Entry</option>
          <option value="customer_service">Customer Service</option>
          <option value="translation">Translation</option>
          <option value="video_editing">Video Editing</option>
          <option value="photography">Photography</option>
          <option value="consulting">Consulting</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Experience Level</label>
        <select
          value={filters.experienceLevel}
          onChange={(e) => handleFilterChange('experienceLevel', e.target.value)}
        >
          <option value="all">All Levels</option>
          <option value="entry">Entry Level</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Duration</label>
        <select
          value={filters.duration}
          onChange={(e) => handleFilterChange('duration', e.target.value)}
        >
          <option value="all">Any Duration</option>
          <option value="less_than_1_week">Less than 1 week</option>
          <option value="1_2_weeks">1-2 weeks</option>
          <option value="1_month">1 month</option>
          <option value="2_3_months">2-3 months</option>
          <option value="3_6_months">3-6 months</option>
          <option value="more_than_6_months">More than 6 months</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Min Budget</label>
        <input
          type="number"
          placeholder="$0"
          value={filters.minBudget}
          onChange={(e) => handleFilterChange('minBudget', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Max Budget</label>
        <input
          type="number"
          placeholder="No limit"
          value={filters.maxBudget}
          onChange={(e) => handleFilterChange('maxBudget', e.target.value)}
        />
      </div>
    </div>
  );
};

export default FilterPanel;
