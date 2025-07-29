import React, { useState } from 'react';
import SEO from './SEO';
import '../Auth/Auth.css';

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSuccess('Thank you for your message! We\'ll get back to you within 24 hours.');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (err) {
      setError('Failed to send message. Please try again.');
    }

    setLoading(false);
  };

  return (
    <>
      <SEO 
        title="Contact Us - FetchWork"
        description="Get in touch with the FetchWork team. We're here to help with any questions about our freelance marketplace platform."
        keywords="contact, support, help, fetchwork, freelance"
      />
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '500px' }}>
          <div className="auth-header">
            <h1 className="auth-title">Contact Us</h1>
            <p className="auth-subtitle">We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name" className="form-label">Full Name</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="subject" className="form-label">Subject</label>
              <input
                id="subject"
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="form-input"
                placeholder="What is this regarding?"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="message" className="form-label">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                className="form-input"
                placeholder="Tell us how we can help you..."
                rows="6"
                style={{ resize: 'vertical', minHeight: '120px' }}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary btn-mobile-friendly">
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Need immediate help? Check out our <a href="/support" className="auth-link">Support Center</a></p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContactUs;
