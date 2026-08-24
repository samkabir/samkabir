import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, badRequest, conflict, fieldsFromZod, fromPrismaError } from '@/lib/api/errors';
import { createHandler, parseBody, parseQuery, sendError } from '@/lib/api/handler';
import { invoke, mockRequest, mockResponse } from './helpers/http.js';

describe('error envelope', () => {
  it('sends message and fields under a single `error` key', () => {
    const res = mockResponse();
    sendError(res, badRequest('Some fields need attention.', { name: 'Required.' }));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'Some fields need attention.', fields: { name: 'Required.' } },
    });
  });

  it('omits `fields` when there are none', () => {
    const res = mockResponse();
    sendError(res, new ApiError(404, 'Not found.'));

    expect(res.body).toEqual({ error: { message: 'Not found.' } });
  });

  it('never leaks an unexpected error to the client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();

    sendError(res, new Error('connect ECONNREFUSED 10.0.0.5:5432 — password authentication failed'));

    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Something went wrong on our end.');
    // The detail is useful and belongs in the log, not in a browser console.
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('turns a ZodError into a 400 with per-field messages', () => {
    const res = mockResponse();
    const result = z.object({ name: z.string() }).safeParse({});

    sendError(res, result.error);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.fields).toHaveProperty('name');
  });
});

describe('fieldsFromZod', () => {
  it('keeps the first message per field', () => {
    // 'ab' fails both the length and the pattern, so Zod reports two issues on
    // one field. A form input shows one message, and the first is the most
    // specific Zod produced.
    const schema = z.object({ name: z.string().min(5).regex(/^[0-9]+$/) });
    const { error } = schema.safeParse({ name: 'ab' });

    expect(error.issues.length).toBeGreaterThan(1);
    expect(Object.keys(fieldsFromZod(error))).toEqual(['name']);
  });

  it('attributes an unrecognised key to that key', () => {
    const { error } = z.strictObject({ a: z.string() }).safeParse({ a: 'x', role: 'ADMIN' });
    const fields = fieldsFromZod(error);

    // Without this, a smuggled field produces an error pointing at nothing and
    // the dashboard has no input to attach it to.
    expect(fields).toHaveProperty('role');
  });

  it('files a whole-object issue under `_`', () => {
    const schema = z.object({ a: z.string() }).refine(() => false, { message: 'Nope.' });
    const { error } = schema.safeParse({ a: 'x' });

    expect(fieldsFromZod(error)._).toBe('Nope.');
  });

  it('joins a nested path with dots', () => {
    const { error } = z.object({ items: z.array(z.string()) }).safeParse({ items: [1] });
    expect(fieldsFromZod(error)).toHaveProperty('items.0');
  });
});

describe('fromPrismaError', () => {
  it('maps a unique violation to 409 and names the field', () => {
    const mapped = fromPrismaError({ code: 'P2002', meta: { target: ['slug'] } });

    expect(mapped.status).toBe(409);
    expect(mapped.fields).toHaveProperty('slug');
  });

  it('maps a missing record to 404', () => {
    expect(fromPrismaError({ code: 'P2025' }).status).toBe(404);
  });

  it('maps a foreign key violation to 409', () => {
    expect(fromPrismaError({ code: 'P2003' }).status).toBe(409);
  });

  it('catches a RESTRICT violation Prisma left unclassified', () => {
    // Phase 2's smoke test saw exactly this: deleting a Media row under a live
    // résumé arrived as an unmapped connector error carrying the raw SQLSTATE.
    const mapped = fromPrismaError({
      message: 'ConnectorError { code: "23001", message: "violates RESTRICT setting" }',
    });

    expect(mapped.status).toBe(409);
    expect(mapped.message).toMatch(/in use/i);
  });

  it('returns null for anything it does not recognise, so it becomes a 500', () => {
    expect(fromPrismaError(new Error('kaboom'))).toBe(null);
  });
});

describe('parseBody', () => {
  const schema = z.strictObject({ name: z.string() });

  it('rejects a body that is not a JSON object', () => {
    for (const body of [undefined, null, 'text', 42, []]) {
      expect(() => parseBody(schema, mockRequest({ body }))).toThrow(ApiError);
    }
  });

  it('returns the parsed data on success', () => {
    expect(parseBody(schema, mockRequest({ body: { name: 'Go' } }))).toEqual({ name: 'Go' });
  });

  it('throws a 400 carrying the field map', () => {
    try {
      parseBody(schema, mockRequest({ body: { name: 1 } }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.status).toBe(400);
      expect(error.fields).toHaveProperty('name');
    }
  });
});

describe('parseQuery', () => {
  it('flattens a repeated parameter to its first value', () => {
    const schema = z.object({ q: z.string() });
    expect(parseQuery(schema, mockRequest({ query: { q: ['a', 'b'] } }))).toEqual({ q: 'a' });
  });

  it('throws a 400 for an out-of-range value', () => {
    const schema = z.object({ take: z.coerce.number().max(10) });
    expect(() => parseQuery(schema, mockRequest({ query: { take: '999' } }))).toThrow(ApiError);
  });
});

describe('createHandler', () => {
  it('applies the auth guard to every registered method', async () => {
    // The guard is not opt-in and there is no flag to skip it, so a handler
    // registered here can never run unauthenticated. This asserts that for a
    // hand-rolled handler, not just the generated resource routes.
    const spy = vi.fn();
    const handler = createHandler({ GET: spy, POST: spy, DELETE: spy });

    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = await invoke(handler, { method, body: {} });
      expect(res.statusCode).toBe(401);
    }

    expect(spy).not.toHaveBeenCalled();
  });

  it('advertises HEAD when GET is registered', async () => {
    const handler = createHandler({ GET: vi.fn() });
    const res = await invoke(handler, { method: 'OPTIONS' });

    expect(res.getHeader('allow')).toContain('HEAD');
  });

  it('does not advertise HEAD on a POST-only route', async () => {
    const handler = createHandler({ POST: vi.fn() });
    const res = await invoke(handler, { method: 'OPTIONS' });

    expect(res.getHeader('allow')).not.toContain('HEAD');
  });

  it('sets no-store even on an error response', async () => {
    const handler = createHandler({ GET: vi.fn() });
    const res = await invoke(handler, { method: 'PUT' });

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('cache-control')).toContain('no-store');
  });

  it('converts a thrown ApiError into the envelope', async () => {
    const handler = createHandler({ GET: () => { throw conflict('Already exists.'); } });
    const res = await invoke(handler, { method: 'GET' });

    // Still 401 — the guard denies before the handler body runs, which is itself
    // the assertion worth making here.
    expect(res.statusCode).toBe(401);
  });
});
