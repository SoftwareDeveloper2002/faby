/**
 * Site-wide "website builder" theme: brand colors, a font pairing, an optional logo, and
 * homepage headline overrides — all editable from Admin Settings, and applied live to every
 * visitor via a single injected <style> tag plus a Google Fonts <link>. See `applyTheme`.
 *
 * Two copies live in Firebase: `settings/theme/draft` (what the admin is experimenting with) and
 * `settings/theme/live` (what everyone else actually sees). Appending `?theme_preview=1` to any
 * URL makes that page render the draft instead, so Admin Settings can open a real preview tab
 * without affecting other visitors — see `getActiveThemePath`.
 */

export type FontPairingKey = 'classic' | 'modern' | 'elegant' | 'friendly';

export type SiteTheme = {
  colors: {
    accent: string;
    bg1: string;
    bg2: string;
  };
  fontPairing: FontPairingKey;
  logoUrl: string;
  homepage: {
    heroTitleOverride: string;
    heroCopyOverride: string;
  };
};

export const DEFAULT_THEME: SiteTheme = {
  colors: { accent: '#9a5d2d', bg1: '#f8efe3', bg2: '#ecd6b8' },
  fontPairing: 'classic',
  logoUrl: '/faby.png',
  homepage: { heroTitleOverride: '', heroCopyOverride: '' },
};

export const FONT_PAIRINGS: Record<
  FontPairingKey,
  { label: string; heading: string; body: string; googleFontsQuery: string }
> = {
  classic: {
    label: 'Classic Serif (current)',
    heading: "'DM Serif Display', serif",
    body: "'Work Sans', sans-serif",
    googleFontsQuery: 'family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@400;500;600;700;800',
  },
  modern: {
    label: 'Modern Sans',
    heading: "'Poppins', sans-serif",
    body: "'Inter', sans-serif",
    googleFontsQuery: 'family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700',
  },
  elegant: {
    label: 'Elegant Editorial',
    heading: "'Playfair Display', serif",
    body: "'Nunito Sans', sans-serif",
    googleFontsQuery: 'family=Playfair+Display:wght@600;700;800&family=Nunito+Sans:wght@400;600;700;800',
  },
  friendly: {
    label: 'Friendly Rounded',
    heading: "'Baloo 2', cursive",
    body: "'Mulish', sans-serif",
    googleFontsQuery: 'family=Baloo+2:wght@600;700;800&family=Mulish:wght@400;500;600;700',
  },
};

/**
 * Pages that share the site's brand-color convention (or a page-specific alias of it — the
 * landing page named its variables before the rest of the site standardized on --accent/--bg-1/
 * --bg-2). Each entry's local variables get overridden with !important so the new brand colors
 * win over the hardcoded per-page defaults, without having to touch every page's own CSS.
 */
const THEMED_PAGE_SELECTORS: Array<{ selector: string; accent: string; bg1: string; bg2: string }> = [
  { selector: '.landing-page', accent: '--rust', bg1: '--sand-1', bg2: '--sand-2' },
  { selector: '.motorcycle-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.tent-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.room-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.table-chair-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.login-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.my-products-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.confirm-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
  { selector: '.payment-page', accent: '--accent', bg1: '--bg-1', bg2: '--bg-2' },
];

const THEMED_PAGE_SELECTOR_LIST = THEMED_PAGE_SELECTORS.map((entry) => entry.selector).join(', ');

function escapeCssValue(value: string): string {
  // Values here only ever come from <input type="color"> (always #rrggbb) or our own font
  // preset table, but guard against anything unexpected sneaking into the injected stylesheet.
  return value.replace(/[^#a-zA-Z0-9%.,() '-]/g, '');
}

function buildThemeStyleText(theme: SiteTheme): string {
  const accent = escapeCssValue(theme.colors.accent || DEFAULT_THEME.colors.accent);
  const bg1 = escapeCssValue(theme.colors.bg1 || DEFAULT_THEME.colors.bg1);
  const bg2 = escapeCssValue(theme.colors.bg2 || DEFAULT_THEME.colors.bg2);
  const pairing = FONT_PAIRINGS[theme.fontPairing] ?? FONT_PAIRINGS.classic;

  const colorRules = THEMED_PAGE_SELECTORS.map(
    (entry) => `${entry.selector}{${entry.accent}:${accent} !important;${entry.bg1}:${bg1} !important;${entry.bg2}:${bg2} !important;}`,
  ).join('\n');

  // motorcycle-page derives a couple of extra shades from --accent/--bg-1 for its darker CTA
  // buttons and a third gradient stop; keep those in sync too instead of leaving them stale.
  const motorcyclePageExtras = `.motorcycle-page{--accent-deep:color-mix(in srgb, var(--accent) 80%, black) !important;--bg-3:color-mix(in srgb, var(--bg-2) 80%, black) !important;}`;

  const fontRules = `
${THEMED_PAGE_SELECTOR_LIST}, .navbar-wrap { font-family: ${pairing.body} !important; }
${THEMED_PAGE_SELECTORS.map((entry) => `${entry.selector} h1, ${entry.selector} h2, ${entry.selector} h3`).join(', ')} { font-family: ${pairing.heading} !important; }
`;

  return `${colorRules}\n${motorcyclePageExtras}\n${fontRules}`;
}

/** Injects/updates the runtime <style> tag and Google Fonts <link> for the given theme. */
export function applyTheme(theme: SiteTheme): void {
  const styleId = 'site-theme-overrides';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildThemeStyleText(theme);

  const pairing = FONT_PAIRINGS[theme.fontPairing] ?? FONT_PAIRINGS.classic;
  const fontLinkId = 'site-theme-font-link';
  let linkEl = document.getElementById(fontLinkId) as HTMLLinkElement | null;
  const href = `https://fonts.googleapis.com/css2?${pairing.googleFontsQuery}&display=swap`;
  if (!linkEl) {
    linkEl = document.createElement('link');
    linkEl.id = fontLinkId;
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);
  }
  if (linkEl.href !== href) {
    linkEl.href = href;
  }
}

/** Fills in any fields missing from a partial/legacy Firebase record with sane defaults. */
export function mergeThemeWithDefaults(value: unknown): SiteTheme {
  const data = (value ?? {}) as Partial<SiteTheme> & { colors?: Partial<SiteTheme['colors']>; homepage?: Partial<SiteTheme['homepage']> };
  const fontPairing = data.fontPairing && data.fontPairing in FONT_PAIRINGS ? data.fontPairing : DEFAULT_THEME.fontPairing;

  return {
    colors: {
      accent: data.colors?.accent || DEFAULT_THEME.colors.accent,
      bg1: data.colors?.bg1 || DEFAULT_THEME.colors.bg1,
      bg2: data.colors?.bg2 || DEFAULT_THEME.colors.bg2,
    },
    fontPairing,
    logoUrl: data.logoUrl || DEFAULT_THEME.logoUrl,
    homepage: {
      heroTitleOverride: data.homepage?.heroTitleOverride ?? '',
      heroCopyOverride: data.homepage?.heroCopyOverride ?? '',
    },
  };
}

/** `draft` while previewing (?theme_preview=1 in the URL), `live` for every other visitor. */
export function getActiveThemePath(): 'settings/theme/draft' | 'settings/theme/live' {
  return isThemePreview() ? 'settings/theme/draft' : 'settings/theme/live';
}

export function isThemePreview(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('theme_preview') === '1';
}
