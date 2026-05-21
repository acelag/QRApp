import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Clock } from 'lucide-react';
import { tableService } from '../../services/tableService';
import { restaurantService } from '../../services/restaurantService';
import { menuService } from '../../services/menuService';
import { sessionService } from '../../services/sessionService';
import { menuPrefetchCache } from '../../services/menuPrefetchCache';

// Default hero — a warm, vibrant restaurant atmosphere shot from Unsplash
const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80';

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function WelcomePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const [restaurantName, setRestaurantName] = useState('Welcome');
  const [logo, setLogo] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#f97316');
  const [waitTimeMin, setWaitTimeMin] = useState<number | null>(null);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState(DEFAULT_HERO);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  // Track whether background prefetch has finished so we can skip the loader
  const prefetchDone = useRef(false);

  useEffect(() => {
    if (!tableId) return;
    tableService.getTable(tableId).then((table) => {
      setTableNumber(table.number);

      // Fire restaurant info + menu data in parallel
      restaurantService.getRestaurantInfo(table.restaurantId).then((info) => {
        setRestaurantName(info.name);
        setLogo(info.logo);
        if (info.themeColor) setThemeColor(info.themeColor);
        if (info.waitTimeMin) setWaitTimeMin(info.waitTimeMin);
        if (info.facebookUrl) setFacebookUrl(info.facebookUrl);
        if (info.instagramUrl) setInstagramUrl(info.instagramUrl);
        if (info.welcomeImageUrl) setHeroUrl(info.welcomeImageUrl);

        // Kick off the heavy menu fetches in the background while the
        // user reads the welcome screen — result stored in the cache so
        // MenuPage can skip its own network calls entirely.
        Promise.all([
          menuService.getCategories(table.restaurantId),
          menuService.getItems(table.restaurantId),
          sessionService.getOrCreate(table.id, table.number, table.restaurantId),
        ]).then(([categories, items, session]) => {
          menuPrefetchCache.set({
            tableId: table.id,
            restaurantId: table.restaurantId,
            tableNumber: table.number,
            categories,
            items,
            sessionId: session.id,
            restaurantInfo: info,
          });
          prefetchDone.current = true;
        }).catch(() => { /* MenuPage will fall back to its own fetch */ });
      });
    }).catch(() => {});
  }, [tableId]);

  const hasSocial = facebookUrl || instagramUrl;

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">

      {/* ── Full-screen background image ── */}
      <img
        src={heroUrl}
        alt="Restaurant ambiance"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.65)' }}
      />

      {/* Gradient — darker at bottom so glass panel stands out */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />

      {/* ── Foreground content ── */}
      <div className="relative z-10 min-h-screen flex flex-col px-5 pt-12 pb-8">

        {/* Logo + restaurant name — vertically centered in remaining space */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {logo ? (
            <img src={logo} alt={restaurantName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-xl" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white/20"
              style={{ backgroundColor: themeColor }}
            >
              <UtensilsCrossed size={28} className="text-white" />
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{restaurantName}</h1>
            {tableNumber !== null && (
              <p className="text-sm text-white/60 mt-0.5">Table {tableNumber}</p>
            )}
          </div>
        </div>

        {/* ── Glass panel — bottom ── */}
        <div
          className="rounded-3xl px-6 pt-6 pb-7 flex flex-col gap-5"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}
        >
          {/* Tagline */}
          <p className="text-center text-white/80 text-sm leading-relaxed">
            Scan. Order. Enjoy — all from your table.
          </p>

          {/* Wait time badge */}
          {waitTimeMin !== null && (
            <div className="flex justify-center">
              <div
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <Clock size={14} />
                <span>Approx. {waitTimeMin} min wait time</span>
              </div>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={() => navigate(`/menu/${tableId}`)}
            className="w-full py-4 rounded-2xl text-white text-lg font-bold active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 4px 20px ${themeColor}66`,
            }}
          >
            View Menu
          </button>

          {/* Social links */}
          {hasSocial && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-white/40 uppercase tracking-widest">Follow us</p>
              <div className="flex items-center gap-3">
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(24,119,242,0.3)', border: '1px solid rgba(24,119,242,0.4)' }}
                  >
                    <FacebookIcon className="w-5 h-5" />
                    Facebook
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(193,53,132,0.3)', border: '1px solid rgba(193,53,132,0.4)' }}
                  >
                    <InstagramIcon className="w-5 h-5" />
                    Instagram
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-white/25">
            Powered by QRA System
          </p>
        </div>
      </div>
    </div>
  );
}
