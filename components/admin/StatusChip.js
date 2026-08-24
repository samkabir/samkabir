import PropTypes from 'prop-types';

/**
 * Publication state and row flags, as small bordered labels.
 *
 * Colour is never the only signal — each chip carries its own word. A
 * draft/published distinction shown only as grey versus purple is invisible to
 * anyone who cannot separate the two, and this dashboard has real consequences
 * behind that difference: one of the two states is on the public internet.
 */

const CHIP_BASE = 'inline-block border px-2 py-0.5 text-[0.65rem] uppercase tracking-widest font-semibold';

const STATUS_STYLES = {
  PUBLISHED: 'border-[#7a61ff] text-[#7a61ff]',
  DRAFT: 'border-[#d2d2d2]/40 text-[#d2d2d2]/60',
};

export default function StatusChip({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;

  return (
    <span className={`${CHIP_BASE} ${style}`}>
      {status === 'PUBLISHED' ? 'Live' : 'Draft'}
    </span>
  );
}

StatusChip.propTypes = { status: PropTypes.oneOf(['DRAFT', 'PUBLISHED']) };

const FLAG_STYLES = {
  accent: 'border-[#7a61ff] text-[#7a61ff]',
  warning: 'border-[#ffd08b] text-[#ffd08b]',
  quiet: 'border-[#d2d2d2]/40 text-[#d2d2d2]/60',
  success: 'border-[#64ffda] text-[#64ffda]',
};

/**
 * A one-word flag on a row — NDA, Featured, Active.
 *
 * `title` is required rather than optional. "NDA" needs explaining exactly once,
 * and a chip whose meaning is only in the developer's head is decoration.
 */
export function Flag({ label, title, tone = 'quiet' }) {
  return (
    <span className={`${CHIP_BASE} ${FLAG_STYLES[tone] ?? FLAG_STYLES.quiet}`} title={title}>
      {label}
    </span>
  );
}

Flag.propTypes = {
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['accent', 'warning', 'quiet', 'success']),
};
