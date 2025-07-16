import React, { useState } from 'react';
import './Jobs.css';

const BrowseJobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [budgetRange, setBudgetRange] = useState('all');

  const sampleJobs = [
    {
      id: 1,
      title: 'React Developer for E-commerce Platform',
      description: 'Looking for an experienced React developer to build a modern e-commerce platform with payment integration.',
      budget: '$2,500 - $5,000',
      category: 'Web Development',
      client: 'TechCorp Solutions',
      posted: '2 hours ago',
      proposals: 8,
      skills: ['React', 'Node.js', 'MongoDB', 'Stripe']
    },
    {
      id: 2,
      title: 'Mobile App UI/UX Design',
      description: 'Need a talented designer to create modern, user-friendly interfaces for our fitness tracking mobile app.',
      budget: '$1,200 - $2,000',
      category: 'Design',
      client: 'FitLife Inc',
      posted: '5 hours ago',
      proposals: 12,
      skills: ['Figma', 'Mobile Design', 'Prototyping', 'User Research']
    },
    {
      id: 3,
      title: 'Content Writer for Tech Blog',
      description: 'Seeking a skilled content writer to create engaging articles about emerging technologies and software development.',
      budget: '$500 - $800',
      category: 'Writing',
      client: 'DevBlog Media',
      posted: '1 day ago',
      proposals: 15,
      skills: ['Technical Writing', 'SEO', 'Research', 'Technology']
    },
    {
      id: 4,
      title: 'Python Data Analysis Project',
      description: 'Need help analyzing customer data and creating visualizations for business insights.',
      budget: '$800 - $1,500',
      category: 'Data Science',
      client: 'Analytics Pro',
      posted: '2 days ago',
      proposals: 6,
      skills: ['Python', 'Pandas', 'Matplotlib', 'SQL']
    }
  ];

  const categories = ['all', 'Web Development', 'Design', 'Writing', 'Data Science', 'Marketing'];
  const budgetRanges = ['all', 'Under $500', '$500 - $1,000', '$1,000 - $3,000', '$3,000+'];

  const filteredJobs = sampleJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || job.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="browse-jobs">
      <div className="jobs-header">
        <h1>Browse Jobs</h1>
        <p>Find your next opportunity from {sampleJobs.length} available projects</p>
      </div>

      <div className="jobs-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search jobs by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-row">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <select
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="filter-select"
          >
            {budgetRanges.map(range => (
              <option key={range} value={range}>
                {range === 'all' ? 'All Budgets' : range}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="jobs-list">
        {filteredJobs.map(job => (
          <div key={job.id} className="job-card">
            <div className="job-header">
              <h3 className="job-title">{job.title}</h3>
              <div className="job-budget">{job.budget}</div>
            </div>
            
            <p className="job-description">{job.description}</p>
            
            <div className="job-skills">
              {job.skills.map(skill => (
                <span key={skill} className="skill-tag">{skill}</span>
              ))}
            </div>
            
            <div className="job-meta">
              <div className="job-client">
                <strong>Client:</strong> {job.client}
              </div>
              <div className="job-stats">
                <span>{job.proposals} proposals</span>
                <span>•</span>
                <span>{job.posted}</span>
              </div>
            </div>
            
            <div className="job-actions">
              <button className="apply-btn">Apply Now</button>
              <button className="save-btn">Save Job</button>
            </div>
          </div>
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="no-jobs">
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria or check back later for new opportunities.</p>
        </div>
      )}
    </div>
  );
};

export default BrowseJobs;
