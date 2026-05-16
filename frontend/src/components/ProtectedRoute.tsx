import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  role?: 'admin' | 'kitchen' | 'super_admin' | 'any';
}

export function ProtectedRoute({ children, role = 'any' }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // super_admin can access everything
  if (user.role === 'super_admin') return <>{children}</>;

  // Kitchen staff can only access /kitchen
  if (user.role === 'kitchen' && role === 'admin') {
    return <Navigate to="/kitchen" replace />;
  }

  if (role !== 'any' && role !== user.role && !(user.role === 'admin')) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
