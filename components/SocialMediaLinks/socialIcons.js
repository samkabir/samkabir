import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkIcon from '@mui/icons-material/Link';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

/**
 * `SocialLink.iconKey` → the component that draws it, and its brand colour.
 *
 * The database stores a key rather than a class name or an SVG, so the icon set
 * stays a frontend concern and no row can dictate markup. This is the lookup that
 * closes that loop, and it lives in its own module because both the sidebar rail
 * and the contact block need it — with different styling but the same mapping.
 *
 * **The colours are written as complete class strings, not built from a hex
 * value.** Tailwind generates utilities by scanning source files for literal
 * class names, so `` hover:text-[${brand}] `` produces a class that no stylesheet
 * defines — the markup would look right, the hover would silently do nothing, and
 * nothing would fail. Spelling both variants out means the scanner sees them
 * here. The cost is two strings per platform; the alternative is a colour that
 * quietly stops working.
 *
 * The rail colours on hover, the contact block colours always, which is why each
 * platform needs both forms.
 */
const ICONS = {
  linkedin: { Icon: LinkedInIcon, hoverClass: 'hover:text-[#0072b1]', colorClass: 'text-[#0072b1]' },
  github: { Icon: GitHubIcon, hoverClass: 'hover:text-[#171515]', colorClass: 'text-[#171515]' },
  facebook: { Icon: FacebookIcon, hoverClass: 'hover:text-[#3b5998]', colorClass: 'text-[#3b5998]' },
};

const FALLBACK = {
  Icon: LinkIcon,
  hoverClass: 'hover:text-[#7a61ff]',
  colorClass: 'text-[#7a61ff]',
};

/**
 * Never returns undefined.
 *
 * `lib/validation/socialLink.js` is the allowlist for `iconKey`, so an unknown
 * key should be unreachable — but it becomes reachable by adding a key to that
 * enum and forgetting this file, and the failure would be an invisible link
 * rather than an error. A generic chain icon is visible and clickable, which is
 * the whole point of the row.
 */
export function socialIcon(iconKey) {
  return ICONS[iconKey] ?? FALLBACK;
}
