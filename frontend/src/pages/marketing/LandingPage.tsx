import { useNavigate } from 'react-router-dom';
import {
  QrCode, Shield, LayoutDashboard, Briefcase, Wallet, ConciergeBell, ChefHat, ArrowRight,
} from 'lucide-react';

interface RoleTile {
  label: string;
  blurb: string;
  Icon: React.ElementType;
  u: string;
  p: string;
  tint: string;   // icon tile bg + text
  ring: string;   // hover ring color
}

const ROLES: RoleTile[] = [
  { label: 'Super Admin', blurb: 'Manage all restaurants, plans & feature flags', Icon: Shield,          u: 'superadmin', p: 'super123',   tint: 'bg-purple-100 text-purple-600', ring: 'hover:ring-purple-300' },
  { label: 'Admin',       blurb: 'Full dashboard — menu, orders, reports & stock',  Icon: LayoutDashboard, u: 'admin',      p: 'admin123',   tint: 'bg-orange-100 text-orange-600', ring: 'hover:ring-orange-300' },
  { label: 'Manager',     blurb: 'Day-to-day operations & staff management',        Icon: Briefcase,       u: 'manager',    p: 'manager123', tint: 'bg-violet-100 text-violet-600', ring: 'hover:ring-violet-300' },
  { label: 'Cashier',     blurb: 'Take orders, settle bills & close tables',        Icon: Wallet,          u: 'cashier',    p: 'cashier123', tint: 'bg-emerald-100 text-emerald-600', ring: 'hover:ring-emerald-300' },
  { label: 'Waiter',      blurb: 'Live orders, assign tables & serve guests',       Icon: ConciergeBell,   u: 'waiter',     p: 'waiter123',  tint: 'bg-sky-100 text-sky-600', ring: 'hover:ring-sky-300' },
  { label: 'Kitchen',     blurb: 'Kitchen display with live tickets & prep timers', Icon: ChefHat,         u: 'kitchen',    p: 'kitchen123', tint: 'bg-rose-100 text-rose-600', ring: 'hover:ring-rose-300' },
];

export function LandingPage() {
  const navigate = useNavigate();

  function openDemo(role: RoleTile) {
    // Pass credentials via router state (not the URL) and auto-submit on the login page.
    navigate('/login', { state: { u: role.u, p: role.p, auto: true } });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50/50 to-white flex flex-col">
      {/* decorative blobs */}
      <div className="pointer-events-none fixed -top-24 -left-24 w-80 h-80 rounded-full bg-orange-200/40 blur-3xl" />
      <div className="pointer-events-none fixed top-20 -right-24 w-96 h-96 rounded-full bg-rose-200/40 blur-3xl" />

      <main className="relative flex-1 max-w-5xl mx-auto w-full px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 mb-5">
            <QrCode size={28} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            QRApp Demo
          </h1>
          <p className="mt-3 text-gray-500 max-w-lg mx-auto">
            Pick a role to explore the app. We'll log you in instantly with demo
            credentials — no typing required. 👇
          </p>
        </div>

        {/* Role tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLES.map((role) => (
            <button
              key={role.u}
              onClick={() => openDemo(role)}
              className={`group text-left bg-white rounded-3xl border border-gray-100 ring-2 ring-transparent ${role.ring} p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all`}
            >
              <div className={`w-12 h-12 rounded-2xl ${role.tint} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <role.Icon size={22} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-lg text-gray-900">{role.label}</h2>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{role.blurb}</p>
              <p className="mt-4 text-xs font-mono text-gray-400">
                {role.u} / {role.p}
              </p>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-10">
          Demo environment · Tap any card to sign in automatically
        </p>
      </main>
    </div>
  );
}
