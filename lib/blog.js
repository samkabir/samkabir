/** Words per minute used for the reading estimate. */
const WORDS_PER_MINUTE = 200;

/**
 * Estimates reading time from Markdown source.
 *
 * Code fences, URLs and Markdown syntax are stripped first, because counting
 * them inflates the estimate badly on a technical post — a 40-line code block is
 * scanned, not read word by word. Always at least 1, since "0 min read" reads
 * like a rendering fault.
 */
export function estimateReadingMinutes(markdown) {
  const prose = String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~>#|]/g, ' ');

  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
