/**
 * The dashboard's navigation, as data.
 *
 * One list, read by the sidebar and checked by a test that every `href` has a
 * page file behind it. A nav item pointing at a route that does not exist is a
 * 404 the author never clicks — they know where their own screens are — so it is
 * worth having something else notice.
 *
 * `description` is not decoration: it is the sidebar's title attribute and the
 * Overview page's card text, so the two cannot describe the same screen
 * differently.
 */
export const ADMIN_NAV = [
  {
    href: '/admin',
    label: 'Overview',
    description: 'What is in the database, and what changed recently',
  },
  {
    href: '/admin/bio',
    label: 'Bio',
    description: 'Name, headline, about text and education',
  },
  {
    href: '/admin/experiences',
    label: 'Experience',
    description: 'Full-time roles and contractual engagements',
  },
  {
    href: '/admin/projects',
    label: 'Projects',
    description: 'Work shown on the homepage and the projects section',
  },
  {
    href: '/admin/skills',
    label: 'Skills',
    description: 'The skills list, in the order it is displayed',
  },
  {
    href: '/admin/links',
    label: 'Links',
    description: 'Social links, and where each one appears',
  },
  {
    href: '/admin/resume',
    label: 'CV',
    description: 'Versioned CV uploads, and which one /cv serves',
  },
  {
    href: '/admin/blogs',
    label: 'Blog',
    description: 'Posts and tags',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'SEO defaults and section headings',
  },
  {
    href: '/admin/account',
    label: 'Account',
    description: 'Password, linked sign-in methods, recent activity',
  },
];

/**
 * Which nav item a URL belongs to.
 *
 * `/admin` is an exact match rather than a prefix — as a prefix it would light up
 * for every screen, since every screen is under it.
 */
export function activeNavHref(pathname) {
  if (!pathname) return null;

  const match = ADMIN_NAV.find(
    (item) => item.href !== '/admin' && pathname.startsWith(item.href)
  );

  if (match) return match.href;
  return pathname === '/admin' ? '/admin' : null;
}
