import { Link } from 'react-router-dom';
import {
  QrCode, Smartphone, ChefHat, Wallet, BarChart3, Boxes, Gift, Building2,
  ArrowRight, Check, ScanLine, UtensilsCrossed, Bell, Star,
} from 'lucide-react';
import { MarketingNav, MarketingFooter } from '../../components/marketing/MarketingNav';

const FEATURES = [
  { Icon: QrCode,      title: 'QR ordering',        blurb: 'Guests scan, browse a live menu and order from their phone — no app, no waiting.' },
  { Icon: ChefHat,     title: 'Kitchen display',    blurb: 'Tickets stream straight to the kitchen with prep timers and live status.' },
  { Icon: Wallet,      title: 'POS & billing',      blurb: 'Take orders, split bills, apply promos and settle tables in seconds.' },
  { Icon: Bell,        title: 'Live order tracking',blurb: 'Real-time updates from “placed” to “served” for staff and guests alike.' },
  { Icon: Boxes,       title: 'Stock control',      blurb: 'Track ingredients, get low-stock alerts and stop selling sold-out items.' },
  { Icon: BarChart3,   title: 'Reports & finance',  blurb: 'Sales, shift-close and staff performance — the full picture, daily.' },
  { Icon: Gift,        title: 'Loyalty & promos',   blurb: 'Reward regulars with points and run promo codes that actually convert.' },
  { Icon: Building2,   title: 'Multi-location',     blurb: 'Run dine-in, takeaway and room service across every branch from one place.' },
];

const STEPS = [
  { Icon: ScanLine,        title: 'Scan',  blurb: 'Guests scan the QR code on their table, room or takeaway counter.' },
  { Icon: UtensilsCrossed, title: 'Order', blurb: 'They browse the live menu and order in seconds — straight from their phone.' },
  { Icon: ChefHat,         title: 'Serve', blurb: 'Orders hit the kitchen instantly. You track, prepare and serve — faster.' },
];

const ROLES = [
  { label: 'Admin & Manager', blurb: 'Full dashboard — menu, orders, reports, stock and staff.' },
  { label: 'Cashier',         blurb: 'Take orders, settle bills and close tables with ease.' },
  { label: 'Waiter',          blurb: 'Live orders, table assignment and faster guest service.' },
  { label: 'Kitchen',         blurb: 'A dedicated display with live tickets and prep timers.' },
];

const TRUST = [
  { value: '60s',   label: 'Faster table turnover' },
  { value: '0',     label: 'Apps to download' },
  { value: '24/7',  label: 'Real-time order sync' },
  { value: '∞',     label: 'Tables & locations' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -top-10 right-0 w-96 h-96 rounded-full bg-emerald-200/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-12 sm:pt-24 sm:pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-xs font-semibold px-3 py-1.5">
              <Star size={13} className="fill-orange-500 text-orange-500" />
              QR ordering & POS, all in one
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Turn every table into a
              <span className="text-orange-500"> live order.</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto lg:mx-0">
              Order Live is the all-in-one platform for restaurants — QR menus, kitchen
              displays, billing and real-time orders. Guests scan and order in seconds,
              your team serves faster.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-colors"
              >
                Start free trial <ArrowRight size={18} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3.5 rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400 flex items-center gap-2 justify-center lg:justify-start">
              <Check size={15} className="text-emerald-500" /> Free trial · no credit card · cancel anytime
            </p>
          </div>

          {/* Hero visual — stylised phone + scan card */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-emerald-100 rounded-[2.5rem] rotate-3" />
            <div className="relative bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-orange-500/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <img src="/orderlive-icon.png" alt="" className="w-10 h-10 object-contain" />
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">● Live</span>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 flex flex-col items-center text-center">
                <QrCode size={88} className="text-gray-900" />
                <p className="mt-3 text-sm font-semibold text-gray-900">Scan to order</p>
                <p className="text-xs text-gray-400">Table 12 · The Spice Garden</p>
              </div>
              <div className="mt-4 space-y-2.5">
                {['Grilled Paneer Tikka', 'Butter Chicken', 'Garlic Naan ×2'].map((item, i) => (
                  <div key={item} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                    <span className="text-sm font-medium text-gray-700">{item}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-emerald-50 text-emerald-600' : i === 1 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                      {i === 0 ? 'Served' : i === 1 ? 'Cooking' : 'Queued'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust stats */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-5 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {TRUST.map((t) => (
            <div key={t.label}>
              <div className="text-3xl font-extrabold text-gray-900">{t.value}</div>
              <div className="text-sm text-gray-500 mt-1">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Everything your restaurant runs on</h2>
          <p className="mt-4 text-gray-500">
            From the first scan to the final bill — one platform replaces the patchwork of
            tools you juggle today.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ Icon, title, blurb }) => (
            <div key={title} className="group bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gradient-to-b from-orange-50/60 to-white">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Live in three steps</h2>
            <p className="mt-4 text-gray-500">No hardware to buy, no app for guests to install. Print a QR code and you're trading.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {STEPS.map(({ Icon, title, blurb }, i) => (
              <div key={title} className="relative bg-white rounded-3xl border border-gray-100 p-7 text-center shadow-sm">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
                <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mt-2 mb-4">
                  <Icon size={26} />
                </div>
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for every role */}
      <section className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Built for every role on the floor</h2>
          <p className="mt-4 text-gray-500">Role-based access means everyone sees exactly what they need — nothing more.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map((r) => (
            <div key={r.label} className="rounded-3xl border border-gray-100 bg-gray-50/60 p-6">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <Smartphone size={18} />
                <h3 className="font-bold text-gray-900">{r.label}</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{r.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-orange-600 px-8 py-14 sm:px-16 sm:py-20 text-center shadow-2xl shadow-orange-500/30">
          <div className="pointer-events-none absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold text-white">Ready to go live?</h2>
          <p className="relative mt-4 text-orange-50 max-w-xl mx-auto">
            Set up your menu, print your QR codes and start taking orders today.
            Your free trial is one click away.
          </p>
          <div className="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-white text-orange-600 font-semibold px-7 py-3.5 rounded-2xl hover:bg-orange-50 transition-colors">
              Start free trial <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-orange-400/30 text-white font-semibold px-7 py-3.5 rounded-2xl border border-white/30 hover:bg-orange-400/50 transition-colors">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
