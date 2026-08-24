import { z } from 'zod';
import { optionalText } from './primitives.js';
import { partialOf } from './common.js';

/**
 * Only the alt text is editable. Everything else on a Media row — url, pathname,
 * mimeType, size, dimensions — describes a file that already exists at the
 * storage provider, and letting a PATCH rewrite those fields would let the
 * database point somewhere the file is not. The upload route in Phase 5 is the
 * only writer of those columns.
 */
export const updateMediaSchema = partialOf(z.strictObject({ alt: optionalText(300) }));
