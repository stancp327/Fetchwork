export const getApiBaseUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-backend.onrender.com' 
    : 'http://localhost:10000';
};

export const apiRequest = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...defaultOptions,
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
};
