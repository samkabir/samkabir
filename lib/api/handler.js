import { ZodError } from 'zod';
import { withAdmin } from '../auth.js';
import { ApiError, badRequest, fieldsFromZod, fromPrismaError } from './errors.js';

/**
 * The single entry point for every admin route.
 *
 * The order is fixed and not configurable: **method allowlist → withAdmin →
 * handler (Zod parse → Prisma call)**. Each step exists to make the next one
 * safe to reason about.
 *
 * The important property is what this function does *not* offer. There is no
 * `public: true`, no `skipAuth`, no way to register a method that runs
 * unguarded. `withAdmin` is applied to every handler on the way through, so a
 * route cannot forget it — the only way to build an unguarded admin route is to
 * not use this function, which is a visible thing to do in review rather than an
 * omission that looks like every other route.
 *
 * Usage:
 *
 *     export default createHandler({
 *       GET: async (req, res) => { … },
 *       PATCH: async (req, res) => { … },
 *     });
 */
export function createHandler(handlers) {
  const methods = Object.keys(handlers);
  const allowed = methods.includes('GET') ? [...methods, 'HEAD'] : methods;
  const allowHeader = [...allowed, 'OPTIONS'].join(', ');

  return async function route(req, res) {
    // Admin responses are per-user and always current. Set before anything can
    // fail, so even an error response cannot be cached by a proxy or by the
    // browser's back-forward cache.
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.setHeader('Allow', allowHeader);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const method = req.method === 'HEAD' && handlers.GET ? 'GET' : req.method;
    const handler = handlers[method];

    if (!handler) {
      sendError(res, new ApiError(405, `${req.method} is not allowed here.`));
      return;
    }

    try {
      await withAdmin(handler)(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
}

/**
 * Writes the error envelope.
 *
 * Anything that is not deliberately classified becomes a 500 with a fixed
 * message. Echoing an unexpected error to the client is how a database host, a
 * file path or a constraint definition ends up in a browser console — the detail
 * goes to the server log, where it is useful and not public.
 */
export function sendError(res, error) {
  const classified =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? badRequest('Some fields need attention.', fieldsFromZod(error))
        : fromPrismaError(error);

  if (!classified) {
    console.error('[api] unhandled error:', error);
    res.status(500).json({ error: { message: 'Something went wrong on our end.' } });
    return;
  }

  if (classified.status >= 500) {
    console.error('[api] %d:', classified.status, error);
  }

  res.status(classified.status).json({
    error: {
      message: classified.message,
      ...(classified.fields ? { fields: classified.fields } : {}),
    },
  });
}

/**
 * Validates a JSON request body.
 *
 * The shape check comes first because Next.js hands back whatever the body
 * parser produced — a string for a bad content-type, `undefined` for an empty
 * body — and passing either to a Zod object schema produces a confusing
 * "expected object, received string" aimed at no field in particular.
 */
export function parseBody(schema, req) {
  const body = req.body;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Expected a JSON object body.');
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw badRequest('Some fields need attention.', fieldsFromZod(result.error));
  }

  return result.data;
}

/** Validates query-string parameters, which arrive as strings or arrays. */
export function parseQuery(schema, req) {
  const flattened = Object.fromEntries(
    Object.entries(req.query ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );

  const result = schema.safeParse(flattened);

  if (!result.success) {
    throw badRequest('Invalid query parameters.', fieldsFromZod(result.error));
  }

  return result.data;
}
