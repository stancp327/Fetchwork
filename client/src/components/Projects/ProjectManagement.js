import React, { useState, useEffect, useCallback } from 'react';
import './ProjectManagement.css';

const ProjectManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/:\d+/, ':10000');
  };

  const API_BASE_URL = getApiBaseUrl();

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [API_BASE_URL]);

  const fetchUserJobs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  }, [API_BASE_URL]);

  const fetchCalendarEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const response = await fetch(`${API_BASE_URL}/api/projects/calendar?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const events = await response.json();
        setCalendarEvents(events);
      }
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchDashboardData();
    fetchUserJobs();
    fetchCalendarEvents();
  }, [fetchDashboardData, fetchUserJobs, fetchCalendarEvents]);

  const fetchJobTimeline = async (jobId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/timeline/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const timelineData = await response.json();
        setTimeline(timelineData);
        setSelectedJob(timelineData.job);
      }
    } catch (error) {
      console.error('Error fetching job timeline:', error);
    } finally {
      setLoading(false);
    }
  };


  // const createMilestone = async (jobId, milestoneData) => {
  //   try {
  //     const token = localStorage.getItem('token');
  //     const response = await fetch(`${API_BASE_URL}/api/projects/job/${jobId}/milestones`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${token}`
  //       },
  //       body: JSON.stringify(milestoneData)
  //     });
      
  //     if (response.ok) {
  //       fetchJobTimeline(jobId);
  //       fetchCalendarEvents();
  //     }
  //   } catch (error) {
  //     console.error('Error creating milestone:', error);
  //   }
  // };

  // const createTask = async (jobId, taskData) => {
  //   try {
  //     const token = localStorage.getItem('token');
  //     const response = await fetch(`${API_BASE_URL}/api/projects/job/${jobId}/tasks`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${token}`
  //       },
  //       body: JSON.stringify(taskData)
  //     });
      
  //     if (response.ok) {
  //       fetchJobTimeline(jobId);
  //       fetchCalendarEvents();
  //     }
  //   } catch (error) {
  //     console.error('Error creating task:', error);
  //   }
  // };

  const updateMilestoneStatus = async (milestoneId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok && selectedJob) {
        fetchJobTimeline(selectedJob._id);
      }
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok && selectedJob) {
        fetchJobTimeline(selectedJob._id);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#fbbf24',
      'in-progress': '#3b82f6',
      'completed': '#10b981',
      'overdue': '#ef4444',
      'todo': '#6b7280',
      'review': '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const renderDashboard = () => (
    <div className="project-dashboard">
      <div className="dashboard-header">
        <h2>Project Management Dashboard</h2>
        <p>Overview of your projects, tasks, and upcoming deadlines</p>
      </div>

      {dashboardData && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-number">{dashboardData.stats.totalJobs}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardData.stats.activeJobs}</div>
            <div className="stat-label">Active Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardData.stats.upcomingDeadlines}</div>
            <div className="stat-label">Upcoming Deadlines</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardData.stats.overdueItems}</div>
            <div className="stat-label">Overdue Items</div>
          </div>
        </div>
      )}

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h3>Upcoming Milestones</h3>
          <div className="milestone-list">
            {dashboardData?.upcomingMilestones?.map(milestone => (
              <div key={milestone._id} className="milestone-item">
                <div className="milestone-info">
                  <h4>{milestone.title}</h4>
                  <p>{milestone.jobId?.title}</p>
                  <span className="milestone-date">Due: {formatDate(milestone.dueDate)}</span>
                </div>
                <div className="milestone-status" style={{ backgroundColor: getStatusColor(milestone.status) }}>
                  {milestone.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Today's Events</h3>
          <div className="event-list">
            {dashboardData?.todayEvents?.map(event => (
              <div key={event._id} className="event-item">
                <div className="event-time">
                  {new Date(event.startDate).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
                <div className="event-info">
                  <h4>{event.title}</h4>
                  <p>{event.relatedJob?.title}</p>
                </div>
                <div className="event-type">{event.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div className="project-timeline">
      <div className="timeline-header">
        <h2>Project Timeline</h2>
        <select 
          value={selectedJob?._id || ''} 
          onChange={(e) => e.target.value && fetchJobTimeline(e.target.value)}
          className="job-selector"
        >
          <option value="">Select a project...</option>
          {jobs.map(job => (
            <option key={job._id} value={job._id}>{job.title}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading timeline...</div>}

      {timeline && (
        <div className="timeline-content">
          <div className="project-info">
            <h3>{timeline.job.title}</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${timeline.progress.overallProgress}%` }}
              ></div>
            </div>
            <p>{timeline.progress.overallProgress}% Complete</p>
          </div>

          <div className="timeline-sections">
            <div className="milestones-section">
              <h4>Milestones ({timeline.progress.completedMilestones}/{timeline.progress.totalMilestones})</h4>
              <div className="milestone-timeline">
                {timeline.milestones.map(milestone => (
                  <div key={milestone._id} className="timeline-milestone">
                    <div className="milestone-marker" style={{ backgroundColor: getStatusColor(milestone.status) }}></div>
                    <div className="milestone-content">
                      <h5>{milestone.title}</h5>
                      <p>{milestone.description}</p>
                      <div className="milestone-meta">
                        <span>Due: {formatDate(milestone.dueDate)}</span>
                        <select 
                          value={milestone.status} 
                          onChange={(e) => updateMilestoneStatus(milestone._id, e.target.value)}
                          className="status-selector"
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tasks-section">
              <h4>Tasks ({timeline.progress.completedTasks}/{timeline.progress.totalTasks})</h4>
              <div className="task-list">
                {timeline.tasks.map(task => (
                  <div key={task._id} className="task-item">
                    <div className="task-status" style={{ backgroundColor: getStatusColor(task.status) }}></div>
                    <div className="task-content">
                      <h5>{task.title}</h5>
                      <p>{task.description}</p>
                      {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                    </div>
                    <select 
                      value={task.status} 
                      onChange={(e) => updateTaskStatus(task._id, e.target.value)}
                      className="status-selector"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCalendar = () => (
    <div className="project-calendar">
      <div className="calendar-header">
        <h2>Project Calendar</h2>
        <p>Deadlines, milestones, and important dates</p>
      </div>

      <div className="calendar-view">
        <div className="calendar-events">
          {calendarEvents.map(event => (
            <div key={event._id} className="calendar-event">
              <div className="event-date">
                <div className="event-day">{new Date(event.startDate).getDate()}</div>
                <div className="event-month">
                  {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
              <div className="event-details">
                <h4>{event.title}</h4>
                <p>{event.description}</p>
                {event.relatedJob && <span className="event-project">{event.relatedJob.title}</span>}
                <div className="event-type-badge" style={{ backgroundColor: getStatusColor(event.type) }}>
                  {event.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="project-management">
      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span role="img" aria-label="bar chart">📊</span> Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <span role="img" aria-label="trending up">📈</span> Timeline
        </button>
        <button 
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <span role="img" aria-label="calendar">📅</span> Calendar
        </button>
      </div>

      <div className="project-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'timeline' && renderTimeline()}
        {activeTab === 'calendar' && renderCalendar()}
      </div>
    </div>
  );
};

export default ProjectManagement;
