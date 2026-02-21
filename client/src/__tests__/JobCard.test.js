import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import JobCard from '../components/Jobs/JobCard';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockJob = {
  _id: '123',
  title: 'Frontend Developer',
  description: 'Build amazing user interfaces with React and modern web technologies. This is a long description that should be truncated after 300 characters to test the truncation functionality properly.',
  client: {
    firstName: 'John',
    lastName: 'Doe'
  },
  budget: {
    type: 'fixed',
    amount: 5000
  },
  duration: '1_2_weeks',
  status: 'open',
  category: 'web_development',
  experienceLevel: 'intermediate',
  isUrgent: true,
  isFeatured: false,
  skills: ['React', 'JavaScript', 'CSS', 'HTML', 'Node.js', 'MongoDB'],
  proposalCount: 12,
  views: 45,
  location: { locationType: 'remote', address: '', city: '', state: '', zipCode: '', coordinates: { type: 'Point', coordinates: [0, 0] }, serviceRadius: 25 }
};

const renderJobCard = (job = mockJob) => {
  return render(
    <BrowserRouter>
      <JobCard job={job} />
    </BrowserRouter>
  );
};

describe('JobCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render job title and basic information', () => {
    renderJobCard();
    
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText(/Posted by John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000 fixed/)).toBeInTheDocument();
    expect(screen.getByText(/1-2 weeks/)).toBeInTheDocument();
  });

  test('should render job status and category tags', () => {
    renderJobCard();
    
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Web Development')).toBeInTheDocument();
    expect(screen.getByText('intermediate')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  test('should truncate long descriptions', () => {
    const longDescriptionJob = {
      ...mockJob,
      description: 'Build amazing user interfaces with React and modern web technologies. This is a very long description that should definitely be truncated after 300 characters because it exceeds the limit set in the component for displaying job descriptions in the card view and should show ellipsis to indicate there is more content available when viewing the full job details page.'
    };
    
    renderJobCard(longDescriptionJob);
    
    const description = screen.getByText(/Build amazing user interfaces/);
    expect(description.textContent).toContain('...');
    expect(description.textContent.length).toBeLessThan(longDescriptionJob.description.length);
  });

  test('should render skills with truncation', () => {
    renderJobCard();
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  test('should render proposal count, views, and location', () => {
    renderJobCard();
    
    expect(screen.getByText(/12 proposals/)).toBeInTheDocument();
    expect(screen.getByText(/45 views/)).toBeInTheDocument();
    expect(screen.getByText(/Remote/)).toBeInTheDocument();
  });

  test('should navigate to job details when View Details button is clicked', () => {
    renderJobCard();
    
    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/123');
  });

  test('should handle hourly budget type', () => {
    const hourlyJob = {
      ...mockJob,
      budget: {
        type: 'hourly',
        amount: 50
      }
    };
    
    renderJobCard(hourlyJob);
    
    expect(screen.getByText(/\$50 \/hr/)).toBeInTheDocument();
  });

  test('should not show urgent tag when job is not urgent', () => {
    const nonUrgentJob = {
      ...mockJob,
      isUrgent: false
    };
    
    renderJobCard(nonUrgentJob);
    
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
  });

  test('should show featured tag when job is featured', () => {
    const featuredJob = {
      ...mockJob,
      isFeatured: true
    };
    
    renderJobCard(featuredJob);
    
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  test('should handle job with no skills', () => {
    const jobWithoutSkills = {
      ...mockJob,
      skills: []
    };
    
    renderJobCard(jobWithoutSkills);
    
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  test('should handle short description without truncation', () => {
    const jobWithShortDescription = {
      ...mockJob,
      description: 'Short description'
    };
    
    renderJobCard(jobWithShortDescription);
    
    const description = screen.getByText('Short description');
    expect(description.textContent).not.toContain('...');
  });
});
