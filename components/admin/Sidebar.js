import PropTypes from 'prop-types';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';

import { ADMIN_NAV, activeNavHref } from '@/lib/adminNav';
import { HINT } from '@/lib/adminTheme';

/**
 * The dashboard's navigation rail.
 *
 * `next/link` rather than `<a href>`: a full page load between screens would
 * re-run `getServerSideProps`, re-authenticate, and throw away every list already
 * fetched. Client-side transitions keep the session check where it belongs — on
 * the first render and on every API call — without paying for it per click.
 *
 * The active item is marked three ways: the accent colour, a left border, and
 * `aria-current="page"`. Colour alone is not a state; the border survives a
 * screenshot in greyscale and `aria-current` survives having no eyes on it at all.
 */
export default function Sidebar({ pathname, onNavigate }) {
  const current = activeNavHref(pathname);

  return (
    <nav aria-label="Dashboard sections">
      <ul className="list-none p-0 m-0">
        {ADMIN_NAV.map((item) => {
          const active = item.href === current;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                title={item.description}
                className={`block border-l-2 pl-4 pr-3 py-2 text-sm transition duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#7a61ff] ${
                  active
                    ? 'border-[#7a61ff] text-[#7a61ff] font-semibold'
                    : 'border-[#d2d2d2]/20 text-[#d2d2d2]/70 hover:text-[#d2d2d2] hover:border-[#d2d2d2]/50'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Box className="pt-6 pl-4 pr-3">
        <Typography className={HINT}>
          Changes save to the database immediately. The public site reads static
          files until Phase 7 switches it over.
        </Typography>
      </Box>
    </nav>
  );
}

Sidebar.propTypes = {
  pathname: PropTypes.string,
  /** Closes the drawer on a narrow screen, where the nav overlays the content. */
  onNavigate: PropTypes.func,
};
