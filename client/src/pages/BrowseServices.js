import React, { useState, useEffect } from 'react';
import jobService from '../services/jobService';

function BrowseServices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const mockServices = [
    {
      id: 1,
      title: "Professional Logo Design",
      freelancer: "Sarah Johnson",
      rating: 4.9,
      reviews: 127,
      price: 75,
      category: "design",
      image: "🎨",
      description: "I will create a modern, professional logo for your business"
    },
    {
      id: 2,
      title: "React Web Development",
      freelancer: "Mike Chen",
      rating: 4.8,
      reviews: 89,
      price: 150,
      category: "development",
      image: "💻",
      description: "Full-stack React application development with modern practices"
    },
    {
      id: 3,
      title: "Content Writing & SEO",
      freelancer: "Emma Wilson",
      rating: 4.7,
      reviews: 203,
      price: 50,
      category: "writing",
      image: "✍️",
      description: "Engaging content writing optimized for search engines"
    },
    {
      id: 4,
      title: "Social Media Marketing",
      freelancer: "David Rodriguez",
      rating: 4.9,
      reviews: 156,
      price: 100,
      category: "marketing",
      image: "📱",
      description: "Complete social media strategy and management"
    },
    {
      id: 5,
      title: "Video Editing & Motion Graphics",
      freelancer: "Lisa Park",
      rating: 4.8,
      reviews: 94,
      price: 120,
      category: "video",
      image: "🎬",
      description: "Professional video editing with motion graphics and effects"
    },
    {
      id: 6,
      title: "Mobile App UI/UX Design",
      freelancer: "Alex Thompson",
      rating: 4.9,
      reviews: 78,
      price: 200,
      category: "design",
      image: "📱",
      description: "Modern mobile app interface and user experience design"
    }
  ];

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'Design & Creative', label: 'Design & Creative' },
    { value: 'Development & IT', label: 'Development & IT' },
    { value: 'Writing & Translation', label: 'Writing & Translation' },
    { value: 'Digital Marketing', label: 'Digital Marketing' },
    { value: 'Video & Animation', label: 'Video & Animation' },
    { value: 'Music & Audio', label: 'Music & Audio' },
    { value: 'Business', label: 'Business' },
    { value: 'Data', label: 'Data' },
    { value: 'Photography', label: 'Photography' }
  ];

  useEffect(() => {
    fetchJobs();
  }, [searchTerm, selectedCategory, priceRange]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const filters = {};
      
      if (searchTerm) filters.search = searchTerm;
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (priceRange !== 'all') {
        if (priceRange === 'low') filters.maxBudget = 75;
        else if (priceRange === 'medium') {
          filters.minBudget = 75;
          filters.maxBudget = 150;
        } else if (priceRange === 'high') filters.minBudget = 150;
      }

      const response = await jobService.getJobs(filters);
      setJobs(response.jobs || []);
    } catch (error) {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="browse-services-page">
      <div className="page-container">
        <h1>Browse Services</h1>
        
        <div className="search-filters">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search services, skills, or freelancers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filters">
            <div className="form-group">
              <label>Category</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Price Range</label>
              <select 
                value={priceRange} 
                onChange={(e) => setPriceRange(e.target.value)}
              >
                <option value="all">All Prices</option>
                <option value="low">Under $75</option>
                <option value="medium">$75 - $150</option>
                <option value="high">Over $150</option>
              </select>
            </div>
          </div>
        </div>

        <div className="services-grid grid grid-3">
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : jobs.map(job => (
            <div key={job._id} className="service-card card">
              <div className="service-image">
                <span className="service-icon">💼</span>
              </div>
              <div className="service-content">
                <h3>{job.title}</h3>
                <p className="service-description">{job.description}</p>
                <div className="service-freelancer">
                  <span>by {job.client?.firstName} {job.client?.lastName}</span>
                </div>
                <div className="service-category">
                  <span className="category">{job.category}</span>
                </div>
                <div className="service-footer">
                  <span className="service-price">
                    {job.budgetType === 'fixed' ? `$${job.budget}` : `$${job.budget}/hr`}
                  </span>
                  <button className="btn">View Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && jobs.length === 0 && (
          <div className="no-results">
            <h3>No jobs found</h3>
            <p>Try adjusting your search criteria or browse all categories.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowseServices;
