import { Link } from 'react-router-dom';
import { QrCode, Smartphone, Receipt, ChefHat, BarChart3, BedDouble, ArrowRight } from 'lucide-react';
import { MarketingNav, MarketingFooter } from '../../components/marketing/MarketingNav';
import { PricingGrid } from '../../components/marketing/PricingGrid';

const FEATURES = [
  { Icon: QrCode,     title: 'QR ordering',        body: 'Customers scan a table, room or takeaway QR and order straight from their phone — no app needed.' },
  { Icon: Smartphone, title: 'Branded welcome',    body: 'A designable welcome screen with your logo, hero image and social links greets every guest.' },
  { Icon: ChefHat,    title: 'Kitchen display',    body: 'Live tickets with prep timers keep the kitchen in sync and orders moving.' },
  { Icon: Receipt,    title: 'Bills & payments',   body: 'Split bills, apply promos, and close tables fast with built-in billing.' },
  { Icon: BedDouble,  title: 'Rooms & takeaway',   body: 'Dine-in, room service and takeaway flows — all from one menu.' },
  { Icon: BarChart3,  title: 'Reports & staff',    body: 'Sales reports, shift close, rosters and staff performance at a glance.' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white" />
        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-orange-600 bg-orange-100 px-3 py-1 rounded-full mb-5">
            QR ordering & POS for restaurants
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight max-w-3xl mx-auto">
            Turn every table into a <span className="text-orange-500">self-service</span> ordering point
          </h1>
          <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">
            Let guests scan, browse and order from their phones while your team manages everything —
            orders, kitchen, bills and staff — from one dashboard.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors">
              Start free trial <ArrowRight size={18} />
            </Link>
            <Link to="/pricing" className="px-6 py-3 rounded-full font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
              See pricing
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-400">14-day free trial · no credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="text-3xl font-extrabold text-center mb-12">Everything you need to run service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
              <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4"><Icon size={20} /></div>
              <h3 className="font-bold text-lg mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <h2 className="text-3xl font-extrabold text-center">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 mt-2 mb-10">Start free, upgrade when you grow.</p>
          <PricingGrid />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-3xl font-extrabold">Ready to modernise your service?</h2>
        <p className="text-gray-500 mt-3">Set up your menu in minutes and start taking QR orders today.</p>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 bg-orange-500 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-orange-600 transition-colors">
          Start your free trial <ArrowRight size={18} />
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
