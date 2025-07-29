export const getApiBaseUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    return 'http://localhost:10000';
  } else {
    return 'https://fetchwork-backend.onrender.com';
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  
  console.log('🔧 API Request Debug:', {
    baseUrl,
    endpoint,
    fullUrl: `${baseUrl}${endpoint}`,
    hasToken: !!token,
    nodeEnv: process.env.NODE_ENV,
    hostname: window.location.hostname
  });
  
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

  console.log('🔧 API Response Debug:', {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    contentType: response.headers.get('content-type')
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔧 API Error Response:', errorText.substring(0, 200));
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const responseText = await response.text();
  console.log('🔧 API Response Preview:', responseText.substring(0, 200));
  
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('🔧 JSON Parse Error - Response was HTML:', responseText.substring(0, 500));
    throw new Error('API response is not valid JSON - received HTML instead');
  }
};
