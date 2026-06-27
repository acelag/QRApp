import { Link } from 'react-router-dom';

export function BrandLogo({ className = 'text-lg' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-extrabold text-gray-900 ${className}`}>
      <img src="/orderlive-icon.png" alt="Order Live" className="w-8 h-8 object-contain" />
      Order Live
    </Link>
  );
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
      <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <BrandLogo />
        <div className="flex items-center gap-1 sm:gap-3 text-sm font-medium">
          <Link to="/pricing" className="px-3 py-2 text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link to="/login" className="px-3 py-2 text-gray-600 hover:text-gray-900">Log in</Link>
          <Link to="/signup" className="px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors">Start free</Link>
        </div>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 mt-20">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <span>© {new Date().getFullYear()} Order Live · QR ordering &amp; POS for restaurants · orderlive.online</span>
        <div className="flex gap-4">
          <Link to="/pricing" className="hover:text-gray-600">Pricing</Link>
          <Link to="/login" className="hover:text-gray-600">Log in</Link>
          <Link to="/signup" className="hover:text-gray-600">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
