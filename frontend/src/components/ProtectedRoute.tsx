import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

type UserRole = 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[]; // undefined = any authenticated user
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <>{children}</>;
  if (!roles || roles.includes(user.role as UserRole)) return <>{children}</>;

  // Redirect to appropriate home for their role
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  return <Navigate to="/admin" replace />;
}
