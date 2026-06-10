import { Link } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useTheme } from '../context/ThemeContext';

interface AdminHeaderProps {
  /** Page title shown on the left. */
  title: string;
  /** Optional subtitle under the title. */
  subtitle?: string;
  /** Back-arrow target. Omit for no back arrow. */
  backTo?: string;
  /** Optional leading icon next to the title. */
  icon?: React.ElementType;
  /** Page-specific actions, rendered left of the standard cluster. */
  children?: React.ReactNode;
}

/**
 * Shared sticky header used across all admin pages.
 * Always includes: language switcher, light/dark toggle, notifications bell.
 */
export function AdminHeader({ title, subtitle, backTo, icon: Icon, children }: AdminHeaderProps) {
  const { dark, toggleDark } = useTheme();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
        {backTo && (
          <Link to={backTo} className="text-gray-600 hover:text-gray-900 shrink-0">
            <ArrowLeft size={20} />
          </Link>
        )}
        {Icon && <Icon size={20} className="text-orange-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>

        {/* Page-specific actions */}
        {children}

        {/* Standard cluster */}
        <button
          onClick={toggleDark}
          className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NotificationBell />
      </div>
    </header>
  );
}
