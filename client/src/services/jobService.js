const API_BASE_URL = 'http://localhost:10000/api';

class JobService {
  async createJob(jobData) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(jobData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create job');
    }
    
    return response.json();
  }

  async getJobs(filters = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) queryParams.append(key, filters[key]);
    });

    const response = await fetch(`${API_BASE_URL}/jobs?${queryParams}`);
    return response.json();
  }

  async getJob(id) {
    const response = await fetch(`${API_BASE_URL}/jobs/${id}`);
    return response.json();
  }

  async updateJob(id, jobData) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/jobs/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(jobData)
    });
    return response.json();
  }

  async deleteJob(id) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/jobs/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  }
}

export default new JobService();
