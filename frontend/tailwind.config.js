/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './*.{html,js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // System-native font stack — no custom font downloads required
        // Priority: sans-serif (browser default) → system-ui → platform-specific → Arial
        sans: [
          'sans-serif',              // 1. Browser's configured default sans-serif
          'system-ui',               // 2. Device system font (modern browsers)
          '-apple-system',           // 3. SF Pro — macOS / iOS / iPadOS
          'BlinkMacSystemFont',      // 4. SF Pro — Chrome on macOS
          '"Segoe UI"',              // 5. Windows 10/11
          'Roboto',                  // 6. Android / Chrome OS
          '"Helvetica Neue"',        // 7. macOS legacy
          'Arial',                   // 8. Universal fallback
        ],
        dashboard: [
          'sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
        ],
      },
      colors: {
        // ── Primary brand (VNPT Blue) + Soft variants ────────────────────
        'primary':                '#004481',  // CTA buttons, links — white text 9.78:1 AAA
        'primary-container':      '#005BAA',  // Gradient end, focus ring — white text 6.83:1 AA
        'primary-soft':           '#155893',  // Long-session comfort: active sidebar, hover state 8.12:1 AAA
        'primary-soft-hover':     '#0F426F',  // Hover on primary-soft — white text 10.85:1 AAA
        'primary-container-soft': '#DFE8F5',  // Panel/card background tint — dark text 12.1:1 AAA
        'deep-teal':              '#003F7A',  // Hover on primary, headings — white text 12.4:1 AAA

        // ── Secondary / Sky Blue (⚠ bg/icon/chart ONLY — never text on light bg) ──
        'secondary':           '#00AEEF',  // Charts, icons, decoration — 2.53:1 fails as text
        'secondary-container': '#2DBCFE',  // Success / positive growth bg — dark text only
        'secondary-fixed':     '#C6E7FF',  // "In Progress" badge bg — on-surface text 13.24:1 AAA

        // ── Tertiary / Amber Brown ─────────────────────────────────────
        'tertiary':            '#964201',  // Warning text, caution — on white 6.83:1 AA
        'tertiary-fixed':      '#FFDBCA',  // "Warning" badge bg — tertiary text 5.28:1 AA
        'tertiary-fixed-dim':  '#C07039',  // Chart data series (3rd) — on surface 4.91:1 AA

        // ── Surface stack (replaces bg-light) ─────────────────────────
        'surface':                    '#F9F9FF',  // Canvas — page background
        'surface-low':                '#F2F3FA',  // Layout blocks — sidebar, panels  (= surface_container_low)
        'surface-container':          '#ECEDF5',  // Tonal layer — card base           (= surface_container)
        'surface-container-lowest':   '#FFFFFF',  // KPI cards, data entry zones       (= surface_container_lowest)
        'surface-high':               '#E7E8EF',  // Floating headers, drawers         (= surface_container_high)
        'surface-variant':            '#ECEDF5',  // Table row hover (alias surface-container)

        // ── Text ───────────────────────────────────────────────────────
        'on-surface':          '#191C21',  // Primary text — body, headings (not pure #000)   16.28:1 AAA
        'on-surface-variant':  '#485070',  // Secondary text — captions, meta, helper         7.53:1 AAA
        'neutral':             '#485070',  // Alias → on-surface-variant (backward compat)

        // ── Border / Ghost ─────────────────────────────────────────────
        'outline-variant':     '#C1C6D3',  // Ghost border — decorative only, use at ≤15% opacity

        // ── Deprecated ────────────────────────────────────────────────
        'bg-light':            '#F2EFE7',  // @deprecated — use surface/surface-low instead

        // ── Semantic ───────────────────────────────────────────────────
        success:               '#10B981',
        warning:               '#F59E0B',
        error:                 '#EF4444',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      // ── Elevation / Shadow ───────────────────────────────────────────
      boxShadow: {
        'cloud':  '0 24px 48px -12px rgba(0, 28, 59, 0.08)',  // High-priority modals, blue-tinted
        'glass':  '0 8px 32px -8px rgba(0, 28, 59, 0.06)',    // Floating nav, filter bars
      },
      // ── Typography Scale (Editorial Authority) ───────────────────────
      fontSize: {
        'display-lg':   ['3.5rem',  { lineHeight: '1.1', fontWeight: '700' }],  // Hero: Total Branch Revenue
        'headline-lg':  ['2rem',    { lineHeight: '1.2', fontWeight: '700' }],  // Key metrics
        'headline-sm':  ['1.5rem',  { lineHeight: '1.3', fontWeight: '600' }],  // Section headers
        'body-md':      ['0.875rem',{ lineHeight: '1.5', fontWeight: '400' }],  // Standard cell data
        'label-md':     ['0.75rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.05em' }], // Table headers ALL CAPS
        'label-sm':     ['0.625rem',{ lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.04em' }], // Editorial captions
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
