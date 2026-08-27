import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import { BUTTON_QUIET_XS, HINT, PANEL } from '@/lib/adminTheme';
import { moveItem } from '@/lib/adminList';

/**
 * A reorderable list of rows.
 *
 * No drag library. The plan allowed for one and it turned out not to be needed:
 * the HTML5 drag events do the pointer half in about thirty lines, and the half
 * a library would actually earn its place for — touch support and animated
 * reflow — is not what this screen needs. One admin, on a desktop, reordering a
 * handful of rows.
 *
 * **Every reorder is also available from the keyboard**, via the ↑/↓ buttons on
 * each row. That is not a nicety here: drag-and-drop is unusable without a
 * pointer, so a list that can only be dragged is a list that can only be
 * reordered by some people. The buttons are the primary implementation and the
 * drag is layered on top, rather than the other way round.
 *
 * The parent owns the order. This component reports the new sequence of ids and
 * renders whatever it is given next — so the optimistic update, the rollback and
 * the request all live in one place, in `useResource`, instead of being split
 * across a component boundary.
 */
export default function SortableList({
  items,
  getId,
  renderRow,
  onReorder,
  disabled = false,
  itemLabel = 'item',
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  // Buttons are re-rendered in a new position after a move, so focus has to be
  // restored explicitly or it falls back to the document body — and a keyboard
  // user loses their place after every single press.
  const buttonsRef = useRef({});

  const ids = items.map(getId);

  const moveTo = (id, targetIndex) => {
    const from = ids.indexOf(id);
    if (from === -1 || targetIndex < 0 || targetIndex >= ids.length || from === targetIndex) return;

    onReorder(moveItem(ids, from, targetIndex));
  };

  const moveBy = (id, delta, direction) => {
    const from = ids.indexOf(id);
    moveTo(id, from + delta);

    // Follow the row that just moved, keeping the same button focused so the key
    // can be pressed again.
    requestAnimationFrame(() => buttonsRef.current[`${id}:${direction}`]?.focus());
  };

  return (
    <ul className="list-none p-0 m-0">
      {items.map((item, index) => {
        const id = getId(item);
        const isDragging = draggingId === id;
        const isOver = overId === id && draggingId !== id;

        return (
          <li
            key={id}
            draggable={!disabled}
            onDragStart={(event) => {
              setDraggingId(id);
              // Firefox ignores a drag with no data attached.
              event.dataTransfer.setData('text/plain', id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
            onDragOver={(event) => {
              // Without this the drop event never fires — the default action is
              // "reject the drop".
              event.preventDefault();
              if (draggingId && draggingId !== id) setOverId(id);
            }}
            onDragLeave={() => setOverId((current) => (current === id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const droppedId = draggingId ?? event.dataTransfer.getData('text/plain');
              setDraggingId(null);
              setOverId(null);
              if (droppedId && droppedId !== id) moveTo(droppedId, index);
            }}
            className={`${PANEL} mb-2 px-4 py-3 transition duration-200 ${
              isDragging ? 'opacity-40' : ''
            } ${isOver ? 'border-[#7a61ff]' : ''} ${disabled ? '' : 'cursor-grab'}`}
          >
            <Box className="flex items-start gap-4">
              <Box className="flex flex-col gap-1 shrink-0">
                <button
                  ref={(node) => {
                    buttonsRef.current[`${id}:up`] = node;
                  }}
                  type="button"
                  className={BUTTON_QUIET_XS}
                  disabled={disabled || index === 0}
                  onClick={() => moveBy(id, -1, 'up')}
                  aria-label={`Move this ${itemLabel} up (currently ${index + 1} of ${items.length})`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  ref={(node) => {
                    buttonsRef.current[`${id}:down`] = node;
                  }}
                  type="button"
                  className={BUTTON_QUIET_XS}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => moveBy(id, 1, 'down')}
                  aria-label={`Move this ${itemLabel} down (currently ${index + 1} of ${items.length})`}
                  title="Move down"
                >
                  ↓
                </button>
              </Box>

              <Box className="min-w-0 grow">{renderRow(item, index)}</Box>
            </Box>
          </li>
        );
      })}

      {items.length > 1 ? (
        <Typography className={`${HINT} pt-1`}>
          Drag a row to reorder, or use the arrows — both save immediately.
        </Typography>
      ) : null}
    </ul>
  );
}

SortableList.propTypes = {
  items: PropTypes.array.isRequired,
  getId: PropTypes.func.isRequired,
  renderRow: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  itemLabel: PropTypes.string,
};
