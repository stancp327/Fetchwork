import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatCategory } from '../../utils/formatters';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const BrowseServices = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    minPrice: '',
    maxPrice: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });

  const apiBaseUrl = getApiBaseUrl();

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);

      const response = await axios.get(`${apiBaseUrl}/api/services?${params}`);
      setServices(response.data.services);
      setPagination(response.data.pagination);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setError(error.response?.data?.error || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (loading) {
    return (
      <div className="user-container">
        <div className="loading">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Browse Services</h1>
        <p>Find professional services from talented freelancers</p>
      </div>

      <div className="filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search services, skills, or keywords..."
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
          <label>Min Price</label>
          <input
            type="number"
            placeholder="$0"
            value={filters.minPrice}
            onChange={(e) => handleFilterChange('minPrice', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Max Price</label>
          <input
            type="number"
            placeholder="No limit"
            value={filters.maxPrice}
            onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
          />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="main-content">
        <div className="section-title">
          {pagination.total} Services Found
        </div>

        {services.length === 0 ? (
          <div className="empty-state">
            <h3>No services found</h3>
            <p>Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <>
            <div className="services-grid">
              {services.map((service) => (
                <div key={service._id} className="service-card">
                  <div className="service-image">
                    {service.gallery && service.gallery.length > 0 ? (
                      <img src={service.gallery[0].url} alt={service.title} />
                    ) : (
                      <div className="placeholder-image">
                        <span>📋</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="service-content">
                    <div className="freelancer-info">
                      <img 
                        src={service.freelancer.profilePicture || '/default-avatar.png'} 
                        alt={`${service.freelancer.firstName} ${service.freelancer.lastName}`}
                        className="freelancer-avatar"
                      />
                      <span>{service.freelancer.firstName} {service.freelancer.lastName}</span>
                      {service.freelancer.rating > 0 && (
                        <span className="rating">⭐ {service.freelancer.rating.toFixed(1)}</span>
                      )}
                    </div>
                    
                    <h3 className="service-title">{service.title}</h3>
                    <p className="service-description">
                      {service.description.substring(0, 100)}
                      {service.description.length > 100 ? '...' : ''}
                    </p>
                    
                    <div className="service-tags">
                      <span className="tag primary">{formatCategory(service.category)}</span>
                      {service.skills.slice(0, 2).map((skill, index) => (
                        <span key={index} className="tag">{skill}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="service-footer">
                    <div className="service-stats">
                      <span>⭐ {service.rating.toFixed(1)} ({service.totalReviews})</span>
                      <span>📦 {service.totalOrders} orders</span>
                    </div>
                    <div className="service-price">
                      <span>Starting at</span>
                      <strong>${service.pricing.basic.price}</strong>
                    </div>
                    <button 
                      onClick={() => navigate(`/services/${service._id}`)}
                      className="btn btn-primary"
                    >
                      View Service
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setPagination(prev => ({ ...prev, page }))}
                      className={pagination.page === page ? 'active' : ''}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseServices;
