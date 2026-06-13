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

  // Build query string from params option
  let url = `${baseUrl}${endpoint}`;
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString();
    if (qs) url += `${endpoint.includes('?') ? '&' : '?'}${qs}`;
    delete options.params;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errText = response.statusText;
    let errData = null;
    try {
      errData = await response.json();
      errText = errData?.error || errData?.message || errText;
    } catch (e) {}
    const err = new Error(errText);
    err.status = response.status;
    err.data   = errData; // full response body — callers can check err.data?.reason
    throw err;
  }

  if (response.status === 204) return null;

  return response.json();
};
