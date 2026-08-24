/**
 * Minimal stand-ins for Next.js's API request and response objects.
 *
 * Only the surface the handlers actually touch is implemented. A full mock of
 * `NextApiResponse` would be mostly unused code, and the narrowness is a feature:
 * if a handler starts using a response method that is not here, the test fails
 * loudly rather than passing against a permissive fake.
 */

export function mockRequest({ method = 'GET', body, query = {}, headers = {} } = {}) {
  return {
    method,
    body,
    query,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  };
}

export function mockResponse() {
  const res = {
    statusCode: null,
    body: undefined,
    headers: {},
    ended: false,

    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return res.headers[name.toLowerCase()];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };

  return res;
}

/** Runs a handler against a mock request and returns the response. */
export async function invoke(handler, options) {
  const res = mockResponse();
  await handler(mockRequest(options), res);
  return res;
}
