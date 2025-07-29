import React, { useState } from 'react';
import SEO from './SEO';
import '../UserComponents.css';

const Support = () => {
  const [activeSection, setActiveSection] = useState('faq');

  const faqData = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I create an account on FetchWork?',
          a: 'Click the "Get Started Free" button on our homepage and fill out the registration form. You can sign up as a freelancer, client, or both.'
        },
        {
          q: 'Is FetchWork free to use?',
          a: 'Yes, creating an account and browsing jobs/services is free. We charge a small platform fee only when you successfully complete transactions.'
        },
        {
          q: 'How do I verify my account?',
          a: 'After registration, check your email for a verification link. You can also add phone verification and identity verification in your profile settings for higher trust levels.'
        }
      ]
    },
    {
      category: 'For Freelancers',
      questions: [
        {
          q: 'How do I find jobs on FetchWork?',
          a: 'Use the "Browse Jobs" section to search for opportunities. You can filter by category, budget, experience level, and location to find the perfect match.'
        },
        {
          q: 'How do I submit a proposal?',
          a: 'Click on any job listing and use the "Apply Now" button. Write a compelling cover letter, set your rate, and attach any relevant files.'
        },
        {
          q: 'When do I get paid?',
          a: 'Payments are held in escrow and released when milestones are completed or the job is finished. Funds typically appear in your account within 2-3 business days.'
        }
      ]
    },
    {
      category: 'For Clients',
      questions: [
        {
          q: 'How do I post a job?',
          a: 'Click "Post a Job" in your dashboard, fill out the job details including title, description, budget, and requirements. Your job will be live immediately.'
        },
        {
          q: 'How do I choose the right freelancer?',
          a: 'Review proposals carefully, check freelancer profiles, ratings, and previous work. You can also message candidates before making a decision.'
        },
        {
          q: 'How does payment protection work?',
          a: 'We use an escrow system that holds your payment securely until work is completed to your satisfaction. This protects both you and the freelancer.'
        }
      ]
    },
    {
      category: 'Payments & Billing',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept major credit cards, debit cards, PayPal, and bank transfers. All payments are processed securely through our payment partners.'
        },
        {
          q: 'What are your fees?',
          a: 'We charge a 5% platform fee on completed transactions, plus standard payment processing fees. There are no upfront costs or monthly subscriptions.'
        },
        {
          q: 'How do I request a refund?',
          a: 'If you\'re not satisfied with the work, you can request a refund through our dispute resolution system. Our team will review the case and mediate a fair solution.'
        }
      ]
    }
  ];

  const supportTopics = [
    {
      title: 'Account Management',
      description: 'Profile settings, verification, and account security',
      icon: '👤'
    },
    {
      title: 'Payment Issues',
      description: 'Billing, refunds, and payment methods',
      icon: '💳'
    },
    {
      title: 'Technical Support',
      description: 'Website issues, bugs, and technical problems',
      icon: '🔧'
    },
    {
      title: 'Dispute Resolution',
      description: 'Project disputes and conflict resolution',
      icon: '⚖️'
    },
    {
      title: 'Safety & Trust',
      description: 'Report suspicious activity and safety concerns',
      icon: '🛡️'
    },
    {
      title: 'Platform Policies',
      description: 'Terms of service, community guidelines, and policies',
      icon: '📋'
    }
  ];

  return (
    <>
      <SEO 
        title="Support Center - FetchWork"
        description="Find answers to common questions and get help with FetchWork. Our comprehensive support center covers everything from getting started to advanced features."
        keywords="support, help, faq, freelance, fetchwork"
      />
      <div className="user-container">
        <div className="user-header">
          <h1>Support Center</h1>
          <p>Find answers to your questions and get the help you need</p>
        </div>

        <div className="support-navigation">
          <button 
            className={`tab-button ${activeSection === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveSection('faq')}
          >
            Frequently Asked Questions
          </button>
          <button 
            className={`tab-button ${activeSection === 'topics' ? 'active' : ''}`}
            onClick={() => setActiveSection('topics')}
          >
            Help Topics
          </button>
          <button 
            className={`tab-button ${activeSection === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveSection('contact')}
          >
            Contact Support
          </button>
        </div>

        {activeSection === 'faq' && (
          <div className="faq-section">
            {faqData.map((category, categoryIndex) => (
              <div key={categoryIndex} className="faq-category">
                <h3 className="faq-category-title">{category.category}</h3>
                <div className="faq-questions">
                  {category.questions.map((item, questionIndex) => (
                    <details key={questionIndex} className="faq-item">
                      <summary className="faq-question">{item.q}</summary>
                      <div className="faq-answer">{item.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'topics' && (
          <div className="help-topics">
            <div className="topics-grid">
              {supportTopics.map((topic, index) => (
                <div key={index} className="topic-card">
                  <div className="topic-icon">{topic.icon}</div>
                  <h3 className="topic-title">{topic.title}</h3>
                  <p className="topic-description">{topic.description}</p>
                  <a href="/contact" className="topic-link">Get Help →</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'contact' && (
          <div className="contact-section">
            <div className="contact-options">
              <div className="contact-card">
                <h3>📧 Email Support</h3>
                <p>Get detailed help via email</p>
                <a href="/contact" className="btn btn-primary">Send Message</a>
              </div>
              <div className="contact-card">
                <h3>💬 Live Chat</h3>
                <p>Chat with our support team</p>
                <button className="btn btn-secondary" onClick={() => window.chatbaseWidget?.open()}>
                  Start Chat
                </button>
              </div>
              <div className="contact-card">
                <h3>📚 Help Center</h3>
                <p>Browse our knowledge base</p>
                <button className="btn btn-outline" onClick={() => setActiveSection('faq')}>
                  View FAQ
                </button>
              </div>
            </div>
            
            <div className="contact-info">
              <h3>Other Ways to Reach Us</h3>
              <div className="contact-details">
                <p><strong>Response Time:</strong> We typically respond within 24 hours</p>
                <p><strong>Business Hours:</strong> Monday - Friday, 9 AM - 6 PM EST</p>
                <p><strong>Emergency Issues:</strong> Use live chat for urgent technical problems</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .support-navigation {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          border-bottom: 2px solid var(--color-border);
        }

        .tab-button {
          padding: 1rem 1.5rem;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          color: var(--color-primary);
        }

        .tab-button.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

        .faq-category {
          margin-bottom: 2rem;
        }

        .faq-category-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid var(--color-border);
        }

        .faq-questions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .faq-item {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        }

        .faq-question {
          padding: 1rem;
          background: var(--color-bg-secondary);
          cursor: pointer;
          font-weight: 500;
          color: var(--color-text-primary);
          list-style: none;
          transition: background 0.2s ease;
        }

        .faq-question:hover {
          background: var(--color-bg-tertiary);
        }

        .faq-answer {
          padding: 1rem;
          color: var(--color-text-secondary);
          line-height: 1.6;
        }

        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .topic-card {
          padding: 1.5rem;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          text-align: center;
          transition: all 0.2s ease;
        }

        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .topic-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .topic-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
        }

        .topic-description {
          color: var(--color-text-secondary);
          margin-bottom: 1rem;
        }

        .topic-link {
          color: var(--color-primary);
          text-decoration: none;
          font-weight: 500;
        }

        .topic-link:hover {
          text-decoration: underline;
        }

        .contact-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .contact-card {
          padding: 1.5rem;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          text-align: center;
        }

        .contact-card h3 {
          margin-bottom: 0.5rem;
          color: var(--color-text-primary);
        }

        .contact-card p {
          color: var(--color-text-secondary);
          margin-bottom: 1rem;
        }

        .contact-info {
          padding: 1.5rem;
          background: var(--color-bg-secondary);
          border-radius: 12px;
        }

        .contact-info h3 {
          margin-bottom: 1rem;
          color: var(--color-text-primary);
        }

        .contact-details p {
          margin-bottom: 0.5rem;
          color: var(--color-text-secondary);
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: var(--color-primary);
          color: white;
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          background: var(--color-secondary);
          color: white;
        }

        .btn-outline {
          background: transparent;
          color: var(--color-primary);
          border: 2px solid var(--color-primary);
        }

        .btn-outline:hover {
          background: var(--color-primary);
          color: white;
        }

        @media (max-width: 768px) {
          .support-navigation {
            flex-direction: column;
            gap: 0;
          }

          .tab-button {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--color-border);
          }

          .topics-grid {
            grid-template-columns: 1fr;
          }

          .contact-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
};

export default Support;
