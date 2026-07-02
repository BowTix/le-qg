// Dynamic API base URL: switches to PHP development server in dev mode, or falls back to local Laragon
const ENV_API_URL = import.meta.env.VITE_API_URL;

const API_BASE = ENV_API_URL
    ? `${ENV_API_URL}/api`
    : (window.location.port && window.location.port !== '80'
        ? 'http://127.0.0.1:8000/api'
        : `${window.location.origin}/quiz/backend/public/api`);

export const PUBLIC_BASE = API_BASE.replace('/api', '');

/**
 * Perform an HTTP request
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('quiz_token');
  
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    
    // Auto-logout if unauthorized (401)
    if (response.status === 401) {
      localStorage.removeItem('quiz_token');
      localStorage.removeItem('quiz_user');
      // Redirect or force reload to trigger login screen state in React app
      window.dispatchEvent(new Event('auth_session_expired'));
    }

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const errorMsg = data.error || `Erreur serveur (${response.status})`;
      throw new Error(errorMsg);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error.message);
    throw error;
  }
}

export const api = {
  get: (endpoint, params = {}) => {
    const query = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const url = query ? `${endpoint}?${query}` : endpoint;
    return request(url, { method: 'GET' });
  },
  
  post: (endpoint, data = {}) => {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  put: (endpoint, data = {}) => {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete: (endpoint, data = {}) => {
    return request(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }
};
