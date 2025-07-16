import React, { useState } from 'react';
import Navigation from './Navigation';

const BrowseJobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const jobs = [
    {
      id: 1,
      title: 'React Developer for E-commerce Site',
      description: 'Looking for an experienced React developer to build a modern e-commerce platform.',
      budget: '$2,000 - $5,000',
      category: 'web-development',
      location: 'Remote',
      postedBy: 'TechCorp Inc.',
      timePosted: '2 hours ago'
    },
    {
      id: 2,
      title: 'Logo Design for Startup',
      description: 'Need a creative logo design for a new tech startup. Modern and minimalist style preferred.',
      budget: '$200 - $500',
      category: 'design',
      location: 'Remote',
      postedBy: 'StartupXYZ',
      timePosted: '5 hours ago'
    },
    {
      id: 3,
      title: 'Content Writer for Blog',
      description: 'Seeking a skilled content writer to create engaging blog posts about technology trends.',
      budget: '$50 - $100 per article',
      category: 'writing',
      location: 'Remote',
      postedBy: 'Digital Agency',
      timePosted: '1 day ago'
    },
    {
      id: 4,
      title: 'Local Photographer for Event',
      description: 'Need a professional photographer for a corporate event in downtown area.',
      budget: '$300 - $600',
      category: 'photography',
      location: 'New York, NY',
      postedBy: 'Event Solutions',
      timePosted: '3 hours ago'
    }
  ];

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'web-development', label: 'Web Development' },
    { value: 'design', label: 'Design' },
    { value: 'writing', label: 'Writing' },
    { value: 'photography', label: 'Photography' }
  ];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || job.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="browse-jobs">
          <h1>Browse Jobs</h1>
          
          <div className="job-filters">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="category-filter">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="jobs-list">
            {filteredJobs.map(job => (
              <div key={job.id} className="job-card">
                <div className="job-header">
                  <h3>{job.title}</h3>
                  <span className="job-budget">{job.budget}</span>
                </div>
                <p className="job-description">{job.description}</p>
                <div className="job-details">
                  <span className="job-location">📍 {job.location}</span>
                  <span className="job-category">🏷️ {job.category}</span>
                </div>
                <div className="job-footer">
                  <span className="posted-by">Posted by {job.postedBy}</span>
                  <span className="time-posted">{job.timePosted}</span>
                  <button className="apply-btn">Apply Now</button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredJobs.length === 0 && (
            <div className="no-jobs">
              <p>No jobs found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowseJobs;
