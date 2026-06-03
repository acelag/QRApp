import { UtensilsCrossed, Clock } from 'lucide-react';

// Default hero — a warm, vibrant restaurant atmosphere shot from Unsplash
export const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80';

/* ── Brand icons (inline SVG — lucide has no brand marks) ─────────────────── */
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
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * Build the href for a social value. WhatsApp accepts either a full link
 * (https://wa.me/… or https://…) or a raw phone number, which is converted
 * into a wa.me link automatically.
 */
export function whatsappHref(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const digits = v.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : v;
}

export interface WelcomeSocial {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
}

const SOCIAL_DEFS: {
  key: keyof WelcomeSocial;
  label: string;
  Icon: React.FC<{ className?: string }>;
  bg: string;
}[] = [
  { key: 'facebookUrl',  label: 'Facebook',  Icon: FacebookIcon,  bg: 'rgba(24,119,242,0.85)' },
  { key: 'instagramUrl', label: 'Instagram', Icon: InstagramIcon, bg: 'rgba(193,53,132,0.85)' },
  { key: 'tiktokUrl',    label: 'TikTok',    Icon: TikTokIcon,    bg: 'rgba(0,0,0,0.85)' },
  { key: 'whatsappUrl',  label: 'WhatsApp',  Icon: WhatsAppIcon,  bg: 'rgba(37,211,102,0.85)' },
  { key: 'youtubeUrl',   label: 'YouTube',   Icon: YouTubeIcon,   bg: 'rgba(255,0,0,0.85)' },
  { key: 'twitterUrl',   label: 'X',         Icon: XIcon,         bg: 'rgba(0,0,0,0.85)' },
];

export interface WelcomeScreenProps {
  restaurantName: string;
  logo?: string | null;
  themeColor?: string;
  heroUrl?: string | null;
  /** Big title — falls back to restaurantName when empty. */
  heading?: string | null;
  /** Small line above the CTA. */
  tagline?: string | null;
  /** Secondary line under the title (e.g. "Table 5", "Takeaway"). */
  subtitle?: string | null;
  waitTimeMin?: number | null;
  waitTimeLabel?: string;
  social?: WelcomeSocial;
  followUsLabel?: string;
  ctaLabel: string;
  poweredByLabel?: string;
  onEnter: () => void;
  /** When true, fills its parent (absolute) instead of the viewport — used for previews. */
  contained?: boolean;
}

/**
 * Full-screen welcome / landing screen shown before a customer menu.
 * Shared by the table, takeaway and room flows, and the admin live preview.
 */
export function WelcomeScreen({
  restaurantName,
  logo,
  themeColor = '#f97316',
  heroUrl,
  heading,
  tagline,
  subtitle,
  waitTimeMin,
  waitTimeLabel,
  social,
  followUsLabel = 'Follow us',
  ctaLabel,
  poweredByLabel,
  onEnter,
  contained = false,
}: WelcomeScreenProps) {
  const title = (heading && heading.trim()) || restaurantName;
  const socialLinks = SOCIAL_DEFS
    .map((d) => {
      const raw = social?.[d.key]?.trim() || null;
      const url = raw && d.key === 'whatsappUrl' ? whatsappHref(raw) : raw;
      return { ...d, url };
    })
    .filter((d) => !!d.url);

  const rootClass = contained
    ? 'absolute inset-0 overflow-hidden bg-black'
    : 'min-h-screen relative overflow-hidden bg-black';

  return (
    <div className={rootClass}>
      {/* Full-screen background image */}
      <img
        src={heroUrl || DEFAULT_HERO}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(0.65)' }}
      />

      {/* Gradient — darker at bottom so the glass panel stands out */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />

      {/* Foreground content */}
      <div className={`relative z-10 flex flex-col px-5 pt-12 pb-8 ${contained ? 'h-full' : 'min-h-screen'}`}>

        {/* Logo + restaurant name — vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {logo ? (
            <img src={logo} alt={title} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-xl" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white/20"
              style={{ backgroundColor: themeColor }}
            >
              <UtensilsCrossed size={28} className="text-white" />
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{title}</h1>
            {subtitle && <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Glass panel — bottom */}
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
          {tagline && (
            <p className="text-center text-white/80 text-sm leading-relaxed">{tagline}</p>
          )}

          {/* Wait time badge */}
          {waitTimeMin != null && waitTimeLabel && (
            <div className="flex justify-center">
              <div
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <Clock size={14} />
                <span>{waitTimeLabel}</span>
              </div>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={onEnter}
            className="w-full py-4 rounded-2xl text-white text-lg font-bold active:scale-[0.97] transition-transform"
            style={{ backgroundColor: themeColor, boxShadow: `0 4px 20px ${themeColor}66` }}
          >
            {ctaLabel}
          </button>

          {/* Social icons */}
          {socialLinks.length > 0 && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-white/40 uppercase tracking-widest">{followUsLabel}</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {socialLinks.map(({ key, label, Icon, bg, url }) => (
                  <a
                    key={key}
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
                    style={{ background: bg, border: '1px solid rgba(255,255,255,0.25)' }}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          {poweredByLabel && (
            <p className="text-center text-xs text-white/25">{poweredByLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
