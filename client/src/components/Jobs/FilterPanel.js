import React from 'react';
import SearchSuggestions from '../common/SearchSuggestions';

const FilterPanel = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key, value) => {
    onFilterChange(key, value);
  };

  return (
    <div className="filters">
      <div className="search-bar">
        <SearchSuggestions
          value={filters.search}
          onSelect={(value) => handleFilterChange('search', value)}
          placeholder="Search jobs, skills, or keywords..."
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

      <div className="filter-group">
        <label>Work Location</label>
        <select
          value={filters.workLocation}
          onChange={(e) => handleFilterChange('workLocation', e.target.value)}
        >
          <option value="all">All Locations</option>
          <option value="remote">Remote Only</option>
          <option value="local">Local/On-site Only</option>
          <option value="hybrid">Hybrid (Remote + Local)</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Specific Location</label>
        <input
          type="text"
          placeholder="City, State, Country (leave empty for remote)"
          value={filters.specificLocation}
          onChange={(e) => handleFilterChange('specificLocation', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label>Job Type</label>
        <select
          value={filters.jobType}
          onChange={(e) => handleFilterChange('jobType', e.target.value)}
        >
          <option value="all">All Job Types</option>
          <option value="fixed_price">Fixed Price Project</option>
          <option value="hourly">Hourly Contract</option>
          <option value="full_time">Full-time Position</option>
          <option value="part_time">Part-time Position</option>
          <option value="contract">Contract Work</option>
          <option value="freelance">Freelance Gig</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Posted</label>
        <select
          value={filters.datePosted}
          onChange={(e) => handleFilterChange('datePosted', e.target.value)}
        >
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Sort By</label>
        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="budget_high">Highest Budget</option>
          <option value="budget_low">Lowest Budget</option>
          <option value="most_proposals">Most Proposals</option>
          <option value="least_proposals">Least Proposals</option>
        </select>
      </div>

      <div className="filter-group">
        <label>
          <input
            type="checkbox"
            checked={filters.urgentOnly}
            onChange={(e) => handleFilterChange('urgentOnly', e.target.checked)}
          />
          Urgent jobs only
        </label>
      </div>

      <div className="filter-group">
        <label>
          <input
            type="checkbox"
            checked={filters.featuredOnly}
            onChange={(e) => handleFilterChange('featuredOnly', e.target.checked)}
          />
          Featured jobs only
        </label>
      </div>
    </div>
  );
};

export default FilterPanel;
