/**
 * The public site's navigation, now that it spans several pages.
 *
 * `navFromSections` (lib/content.js) builds same-page `#anchor` links for the
 * single-page layout. The site is now Home / Work / About / Writing, so the nav
 * maps each section to the page it lives on instead. It still reads the same
 * `SectionCopy` rows, which keeps two dashboard controls working:
 *
 *   * `navLabel` (falling back to `heading`) is the link text, and
 *   * `showInNav: false` hides the link.
 *
 * Contact is not a page: the contact block is the footer of every page, so its
 * link is the `#contact` fragment, which resolves on whichever page you are on.
 * Writing appears only once a post is published, as before.
 *
 * Pure, so it can run on either side of `getStaticProps` and be tested without a
 * database.
 */
const ROUTES = [
  { key: 'projects', href: '/work', fallback: 'Work' },
  { key: 'about', href: '/about', fallback: 'About' },
];

export function siteNav(sections = {}, { hasPosts = false } = {}) {
  const items = [];

  for (const route of ROUTES) {
    const section = sections[route.key];
    if (section && section.showInNav === false) continue;
    items.push({
      key: route.key,
      label: section?.navLabel || route.fallback,
      href: route.href,
    });
  }

  if (hasPosts) {
    items.push({ key: 'blog', label: 'Writing', href: '/blog' });
  }

  const contact = sections.contact;
  if (!contact || contact.showInNav !== false) {
    items.push({ key: 'contact', label: contact?.navLabel || 'Contact', href: '#contact' });
  }

  return items;
}

/** True when `href` is the page at `pathname` (or a page beneath it). */
export function isActivePath(href, pathname = '') {
  if (!href.startsWith('/')) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
