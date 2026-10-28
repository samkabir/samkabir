import { describe, expect, it } from 'vitest';

import { isActivePath, siteNav } from '@/lib/siteNav';

/**
 * The multi-page nav is derived from `SectionCopy`, so the two dashboard
 * controls that shaped the old nav — the label and `showInNav` — must still
 * shape this one.
 */
const sections = {
  about: { key: 'about', navLabel: 'About', heading: 'About Me', showInNav: true },
  projects: { key: 'projects', navLabel: 'Work', heading: 'Projects', showInNav: true },
  contact: { key: 'contact', navLabel: 'Contact', heading: 'Get In Touch', showInNav: true },
};

describe('siteNav', () => {
  it('maps sections to their pages, with contact as the footer fragment', () => {
    expect(siteNav(sections).map((item) => [item.label, item.href])).toEqual([
      ['Work', '/work'],
      ['About', '/about'],
      ['Contact', '#contact'],
    ]);
  });

  it('adds Writing only when a post is published', () => {
    expect(siteNav(sections).some((item) => item.href === '/blog')).toBe(false);
    expect(siteNav(sections, { hasPosts: true }).some((item) => item.href === '/blog')).toBe(true);
  });

  it('honours showInNav: false', () => {
    const hidden = { ...sections, about: { ...sections.about, showInNav: false } };
    expect(siteNav(hidden).some((item) => item.href === '/about')).toBe(false);
  });

  it('uses the dashboard label', () => {
    const renamed = { ...sections, projects: { ...sections.projects, navLabel: 'Projects' } };
    expect(siteNav(renamed)[0].label).toBe('Projects');
  });

  it('falls back to sensible labels on an unseeded database', () => {
    expect(siteNav({}).map((item) => item.label)).toEqual(['Work', 'About', 'Contact']);
  });
});

describe('isActivePath', () => {
  it('matches a page and the pages beneath it', () => {
    expect(isActivePath('/blog', '/blog')).toBe(true);
    expect(isActivePath('/blog', '/blog/some-post')).toBe(true);
    expect(isActivePath('/work', '/about')).toBe(false);
  });

  it('treats home as exact and ignores fragments', () => {
    expect(isActivePath('/', '/work')).toBe(false);
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('#contact', '/')).toBe(false);
  });
});
