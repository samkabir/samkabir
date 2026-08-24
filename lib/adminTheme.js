import { createTheme } from '@mui/material/styles';

/**
 * The dashboard's visual vocabulary, in one file.
 *
 * Every value here already existed somewhere in this repository — the accent, the
 * body text grey, the page background, the panel blue are the site's own colours,
 * pulled out of the components rather than invented for the admin. That is the
 * point: the dashboard is a back room of the same building, not a second product,
 * and a reader who knows the public site should recognise it.
 *
 * There are two styling systems in play and they have a clear division of labour:
 *
 *   * **Tailwind class strings** (below) for everything this project builds by
 *     hand — inputs, buttons, panels. The public site is Tailwind, the Phase 4
 *     login form is Tailwind, and the class strings were already being copied
 *     between files. Naming them stops the copies from drifting.
 *
 *   * **The MUI theme** (bottom) for the components that come with their own
 *     stylesheet — Dialog, Snackbar, Tooltip, CircularProgress. Those render
 *     against MUI's default *light* palette unless told otherwise, which on a
 *     `#141e30` page is a white box in a dark room.
 *
 * `tailwind.config.js` sets `important: true`, so every Tailwind utility carries
 * `!important` and beats MUI's emotion classes. That is a hazard worth stating:
 * a Tailwind class on a themed MUI component wins silently, which is why themed
 * components are left to the theme and hand-built ones are left to Tailwind,
 * rather than mixing the two on one element.
 */

/** Colours, all of them already present in the public site's components. */
export const COLORS = {
  /** The site's accent — links, headings, focus rings, primary buttons. */
  accent: '#7a61ff',
  /** The darker accent, used for a pressed or hovered accent surface. */
  accentDeep: '#5845c4',
  /** Body text. */
  text: '#d2d2d2',
  /** Page background, as set on `body` in globals.css. */
  background: '#141e30',
  /** A raised surface — dialogs, menus. */
  surface: '#233352',
  /** Errors. The border weight and the text weight differ, so both are named. */
  danger: '#ff6b6b',
  dangerText: '#ff9b9b',
  /** Warnings: something is not wrong yet but will be. */
  warning: '#ffd08b',
  /** Success, as used by the public site's accent-secondary. */
  success: '#64ffda',
};

/**
 * Focus styling, applied to everything interactive.
 *
 * `outline-none` alone would be an accessibility regression — it removes the
 * browser's own focus indicator — so it never appears without a replacement
 * ring. `focus-visible` rather than `focus` so a mouse click does not leave a
 * ring behind, while tabbing always shows one.
 */
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-[#7a61ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141e30]';

const INPUT_BASE =
  'w-full bg-transparent border-2 border-[#d2d2d2]/30 focus:border-[#7a61ff] ' +
  'text-[#d2d2d2] transition duration-300 disabled:opacity-50 outline-none';

/** A text input, select or textarea at form size. */
export const INPUT = `${INPUT_BASE} px-4 py-3`;

/** The same, at the size used inside table rows and beside a preview. */
export const INPUT_SM = `${INPUT_BASE} px-4 py-2 text-sm`;

/** Marks an input whose value the server or the schema rejected. */
export const INPUT_INVALID = 'border-[#ff6b6b] focus:border-[#ff6b6b]';

const BUTTON_BASE =
  `transform transition duration-500 border-2 font-semibold normal-case ${FOCUS} ` +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const ACCENT_FILL =
  'border-[#7a61ff] text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] ' +
  'disabled:hover:bg-transparent disabled:hover:text-[#7a61ff]';

const DANGER_FILL =
  'border-[#ff6b6b] text-[#ff9b9b] hover:text-[#000] hover:bg-[#ff6b6b] ' +
  'disabled:hover:bg-transparent disabled:hover:text-[#ff9b9b]';

const QUIET_FILL =
  'border-[#d2d2d2]/30 text-[#d2d2d2]/80 hover:border-[#d2d2d2]/70 hover:text-[#d2d2d2]';

/** Primary action, form-sized. */
export const BUTTON = `${BUTTON_BASE} ${ACCENT_FILL} py-3 px-6`;
/** Primary action, sized for a toolbar. */
export const BUTTON_SM = `${BUTTON_BASE} ${ACCENT_FILL} py-2 px-5 text-sm`;
/** Primary action, sized for a table row. */
export const BUTTON_XS = `${BUTTON_BASE} ${ACCENT_FILL} py-1 px-3 text-xs`;

/** A secondary action — Cancel, Close, Refresh. */
export const BUTTON_QUIET = `${BUTTON_BASE} ${QUIET_FILL} py-2 px-5 text-sm`;
export const BUTTON_QUIET_XS = `${BUTTON_BASE} ${QUIET_FILL} py-1 px-3 text-xs`;

/** A destructive action. Never the default focus target in a dialog. */
export const BUTTON_DANGER = `${BUTTON_BASE} ${DANGER_FILL} py-2 px-5 text-sm`;
export const BUTTON_DANGER_XS = `${BUTTON_BASE} ${DANGER_FILL} py-1 px-3 text-xs`;

/** An underlined text action, for row-level verbs where a border would be noise. */
export const LINK_ACTION =
  `text-[#d2d2d2]/70 text-xs underline hover:text-[#d2d2d2] ${FOCUS} disabled:opacity-40`;
export const LINK_DANGER =
  `text-[#d2d2d2]/70 text-xs underline hover:text-[#ff9b9b] ${FOCUS} disabled:opacity-40`;

/** A bordered container: the dashboard's only box. */
export const PANEL = 'border-2 border-[#d2d2d2]/20';

/** A field label. */
export const LABEL = 'block text-[#d2d2d2] text-sm pb-2';

/** Explanatory text under a label or a panel heading. */
export const HINT = 'text-[#d2d2d2]/50 text-xs leading-relaxed';

/** An inline error message. */
export const ERROR_TEXT = 'text-[#ff9b9b] text-xs';

/** A whole-panel error or warning banner. */
export const BANNER_ERROR = 'border-2 border-[#ff6b6b] text-[#ff9b9b] px-4 py-3 text-sm';
export const BANNER_WARNING = 'border-2 border-[#ffd08b] text-[#ffd08b] px-4 py-3 text-sm';

/**
 * MUI's theme, for the components that ship their own styles.
 *
 * Deliberately small. Every override here answers "this component would
 * otherwise render light-on-light against the site's dark background", and
 * nothing here re-implements a Tailwind class. `mode: 'dark'` alone gets most of
 * the way; the palette entries make the accent the site's accent rather than
 * MUI's indigo.
 *
 * `fontFamily: inherit` matters: the pages apply the Rubik class from
 * `next/font`, and MUI's default Roboto stack would override it inside a Dialog
 * — two typefaces in one screen, for no reason.
 */
export const adminTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: COLORS.accent, dark: COLORS.accentDeep, contrastText: '#000000' },
    error: { main: COLORS.danger },
    warning: { main: COLORS.warning },
    success: { main: COLORS.success },
    background: { default: COLORS.background, paper: COLORS.surface },
    text: { primary: COLORS.text, secondary: 'rgba(210, 210, 210, 0.7)' },
    divider: 'rgba(210, 210, 210, 0.2)',
  },

  typography: { fontFamily: 'inherit' },

  shape: {
    // The site has no rounded corners anywhere. A rounded dialog in a square
    // design reads as a component someone forgot to style.
    borderRadius: 0,
  },

  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `2px solid rgba(210, 210, 210, 0.2)`,
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        // The dashboard is one screen wide; a full-width dialog on a phone is
        // the readable option.
        fullWidth: true,
        maxWidth: 'sm',
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: COLORS.surface, color: COLORS.text, fontSize: '0.75rem' },
      },
    },
  },
});

export default adminTheme;
