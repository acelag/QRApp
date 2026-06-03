import { MarketingNav, MarketingFooter } from '../../components/marketing/MarketingNav';
import { PricingGrid } from '../../components/marketing/PricingGrid';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <MarketingNav />
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold">Pricing that scales with you</h1>
        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Every paid plan starts with a free trial. Cancel anytime — no long-term contracts.
        </p>
      </section>
      <section className="max-w-6xl mx-auto px-5 pb-16">
        <PricingGrid />
      </section>
      <MarketingFooter />
    </div>
  );
}
