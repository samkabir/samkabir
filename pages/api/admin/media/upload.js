// Route file: mounts the shared handler. All behaviour — method allowlist, auth,
// validation, audit — lives in lib/api. See lib/api/handler.js.
import { uploadHandler } from '@/lib/api/resources/upload';

/**
 * Next.js parses this at compile time, so it must be a literal object in the
 * route file itself — a re-exported constant fails the build with "config needs
 * to be a static object". Hence the one exception to route files carrying no
 * content of their own.
 *
 * `bodyParser: false` is load-bearing. Without it the built-in parser consumes
 * the stream, tries to read binary as JSON, and applies its own 1 MB limit — so
 * the handler receives an already-drained request and its size cap never runs.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default uploadHandler;
