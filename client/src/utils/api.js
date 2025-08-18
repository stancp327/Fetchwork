export const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl && !/fetchwork-backend\.onrender\.com/i.test(envUrl)) {
    return envUrl;
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://fetchwork-1.onrender.com'
    : 'http://localhost:10000';
};

export const apiRequest = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');

  const isFormData = options.body instanceof FormData;

  const defaultHeaders = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const headers = isFormData
    ? { ...defaultHeaders, ...options.headers }
    : { 'Content-Type': 'application/json', ...defaultHeaders, ...options.headers };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errText = response.statusText;
    try {
      const data = await response.json();
      errText = data?.error || data?.message || errText;
    } catch (e) {}
    throw new Error(errText);
  }

  if (response.status === 204) return null;

  return response.json();
};
