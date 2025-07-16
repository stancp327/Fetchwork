import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Jobs.css';

const PostJob = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web Development',
    budget: '',
    budgetType: 'fixed',
    skills: '',
    duration: 'less-than-1-month',
    experienceLevel: 'intermediate'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const categories = [
    'Web Development',
    'Mobile Development', 
    'Design',
    'Writing',
    'Data Science',
    'Marketing',
    'Video & Animation',
    'Music & Audio',
    'Programming & Tech',
    'Business'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          title: '',
          description: '',
          category: 'Web Development',
          budget: '',
          budgetType: 'fixed',
          skills: '',
          duration: 'less-than-1-month',
          experienceLevel: 'intermediate'
        });
      }, 3000);
    }, 1500);
  };

  // if (user?.userType !== 'client') {
  //   return (
  //     <div className="post-job">
  //       <div className="access-denied">
  //         <h2>Access Restricted</h2>
  //         <p>Only clients can post jobs. Switch to a client account to access this feature.</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (success) {
    return (
      <div className="post-job">
        <div className="success-message">
          <div className="success-icon">✅</div>
          <h2>Job Posted Successfully!</h2>
          <p>Your job has been published and freelancers can now apply.</p>
          <button onClick={() => setSuccess(false)} className="post-another-btn">
            Post Another Job
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="post-job">
      <div className="post-job-header">
        <h1>Post a New Job</h1>
        <p>Find the perfect freelancer for your project</p>
      </div>

      <form onSubmit={handleSubmit} className="post-job-form">
        <div className="form-section">
          <h3>Job Details</h3>
          
          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g. Build a responsive website with React"
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Job Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="6"
              placeholder="Describe your project in detail. Include requirements, deliverables, and any specific instructions..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="skills">Required Skills</label>
            <input
              type="text"
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="e.g. React, Node.js, MongoDB (comma separated)"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Budget & Timeline</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="budgetType">Budget Type *</label>
              <select
                id="budgetType"
                name="budgetType"
                value={formData.budgetType}
                onChange={handleChange}
                required
              >
                <option value="fixed">Fixed Price</option>
                <option value="hourly">Hourly Rate</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budget">
                {formData.budgetType === 'fixed' ? 'Project Budget ($)' : 'Hourly Rate ($)'} *
              </label>
              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                required
                placeholder={formData.budgetType === 'fixed' ? '1000' : '25'}
                min="1"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="duration">Project Duration *</label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
              >
                <option value="less-than-1-month">Less than 1 month</option>
                <option value="1-3-months">1-3 months</option>
                <option value="3-6-months">3-6 months</option>
                <option value="more-than-6-months">More than 6 months</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="experienceLevel">Experience Level *</label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleChange}
                required
              >
                <option value="entry">Entry Level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="submit-job-btn">
            {isSubmitting ? 'Posting Job...' : 'Post Job'}
          </button>
          <button type="button" className="save-draft-btn">
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostJob;
