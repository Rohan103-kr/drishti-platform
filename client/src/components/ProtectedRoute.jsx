import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('drishti_admin_token');

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  // Basic token expiry check (JWT decode without verification)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('drishti_admin_token');
      return <Navigate to="/admin" replace />;
    }
  } catch {
    localStorage.removeItem('drishti_admin_token');
    return <Navigate to="/admin" replace />;
  }

  return children;
}
