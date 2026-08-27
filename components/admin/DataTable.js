import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import { HINT, INPUT_SM, LABEL, PANEL } from '@/lib/adminTheme';

import { ErrorState, LoadingRows } from './States';

/**
 * A table for lists that are read and filtered rather than dragged.
 *
 * Blog posts, résumé versions, tags, audit entries — anything whose order is
 * decided by a date or a version number rather than by hand. Lists the user
 * arranges use `SortableList` instead, because a `<table>` is the wrong element
 * to make draggable and a poor one to reorder with a keyboard.
 *
 * Horizontal scrolling is contained: the wrapper scrolls, the page does not. A
 * table that widens the document pushes the sidebar off-screen on a tablet and
 * makes every screen scroll sideways, including the ones that fit.
 */
export default function DataTable({
  columns,
  rows,
  getId = (row) => row.id,
  actions,
  loading = false,
  error = null,
  onRetry,
  empty,
  caption,
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) return <LoadingRows rows={4} />;
  if (rows.length === 0 && empty) return empty;

  return (
    <Box className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        {/* Not decoration: a table with no caption is announced as "table" and
            nothing else. Visually hidden because the panel heading already says
            it on screen. */}
        {caption ? <caption className="sr-only">{caption}</caption> : null}

        <thead>
          <tr className="border-b-2 border-[#d2d2d2]/20">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`text-[#d2d2d2]/60 text-xs uppercase tracking-widest font-semibold py-3 pr-4 ${
                  column.hideOnNarrow ? 'hidden md:table-cell' : ''
                }`}
              >
                {column.header}
              </th>
            ))}

            {actions ? (
              <th scope="col" className="text-right py-3">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className="border-b border-[#d2d2d2]/10 align-top">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`py-3 pr-4 text-[#d2d2d2] text-sm ${
                    column.hideOnNarrow ? 'hidden md:table-cell' : ''
                  }`}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}

              {actions ? (
                <td className="py-3 text-right whitespace-nowrap">{actions(row)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.string.isRequired,
      render: PropTypes.func,
      hideOnNarrow: PropTypes.bool,
    })
  ).isRequired,
  rows: PropTypes.array.isRequired,
  getId: PropTypes.func,
  actions: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  empty: PropTypes.node,
  caption: PropTypes.string,
};

/**
 * Search, filter and the primary action, above a list.
 *
 * Search goes to the server rather than filtering the loaded page — `?q=` is an
 * indexed `contains` across the entity's text fields, and filtering client-side
 * would search only the first hundred rows while appearing to search everything.
 * That is the kind of wrong answer nobody checks.
 *
 * The filter is a `<select>` and not a row of tab buttons because it has three
 * states, one of which is "no filter", and a three-way toggle is harder to read
 * than a list that names all three.
 */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  status,
  onStatus,
  showStatus = true,
  action,
  count,
  countLabel = 'items',
}) {
  return (
    <Box className={`${PANEL} px-4 py-4 mb-4`}>
      <Box className="flex flex-wrap items-end gap-4">
        {onSearch ? (
          <Box className="grow min-w-[12rem]">
            <label htmlFor="list-search" className={LABEL}>
              Search
            </label>
            <input
              id="list-search"
              type="search"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(event) => onSearch(event.target.value)}
              className={INPUT_SM}
            />
          </Box>
        ) : null}

        {showStatus && onStatus ? (
          <Box className="min-w-[10rem]">
            <label htmlFor="list-status" className={LABEL}>
              Status
            </label>
            <select
              id="list-status"
              value={status ?? ''}
              onChange={(event) => onStatus(event.target.value)}
              className={INPUT_SM}
            >
              <option value="">All</option>
              <option value="PUBLISHED">Live</option>
              <option value="DRAFT">Draft</option>
            </select>
          </Box>
        ) : null}

        {action ? <Box className="shrink-0 pb-0.5">{action}</Box> : null}
      </Box>

      {typeof count === 'number' ? (
        <Typography className={`${HINT} pt-3`}>
          {count} {countLabel}
          {search ? ' matching' : ''}
        </Typography>
      ) : null}
    </Box>
  );
}

ListToolbar.propTypes = {
  search: PropTypes.string,
  onSearch: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  status: PropTypes.string,
  onStatus: PropTypes.func,
  showStatus: PropTypes.bool,
  action: PropTypes.node,
  count: PropTypes.number,
  countLabel: PropTypes.string,
};
