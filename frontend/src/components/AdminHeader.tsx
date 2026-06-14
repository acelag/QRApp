import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, ChevronDown, Sun, Moon, House } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { SoundAlertToggle } from './SoundAlertToggle';
import { PrinterStatusIndicator } from './PrinterStatusIndicator';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavMode } from '../context/NavModeContext';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  icon?: React.ElementType;
  children?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, backTo, icon: Icon, children }: AdminHeaderProps) {
  const { user, logout } = useAuth();
  const { dark, toggleDark } = useTheme();
  const { navMode } = useNavMode();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    // pointerdown fires on both mouse and touch (mousedown misses touch on Android WebView)
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <div className="px-3 sm:px-4 lg:px-6 py-4 flex items-center gap-3">
        {navMode === 'launcher' && (
          <Link to="/admin/launcher" className="text-gray-500 hover:text-orange-500 transition-colors shrink-0" title="Home">
            <House size={20} />
          </Link>
        )}
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

        <PrinterStatusIndicator />
        <SoundAlertToggle />

        <button
          onClick={toggleDark}
          className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NotificationBell />

        {/* User menu */}
        <div className="relative shrink-0" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            {/* Name + role */}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] text-gray-400 capitalize leading-tight">{user?.role ?? ''}</p>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50">
              {/* User info (mobile only — hidden on sm+) */}
              <div className="sm:hidden px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
