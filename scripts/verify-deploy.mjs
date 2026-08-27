/**
 * Post-deploy verification — the mechanical half of the Phase 11 checklist,
 * executed rather than skimmed.
 *
 *     npm run verify:deploy https://your-app.vercel.app
 *
 * The plan names environment drift as where a project like this fails: a missing
 * variable, an unregistered redirect URI, an unpooled connection string. Most of
 * those surface as one of the checks below going red, which is the point — a
 * checklist a human reads top to bottom skips the one line that mattered.
 *
 * What this canNOT check, and stays a manual step: that both sign-in methods
 * actually work, that a save updates the public page, that an upload succeeds,
 * and Lighthouse. Those need a real session and a browser. This covers the rest:
 * the site is real content, the headers are on, the guards hold, and drafts stay
 * invisible.
 *
 * No dependencies and no `.env` — it only makes HTTP requests to the given
 * origin, so it is safe to run against production. Exit code is non-zero if any
 * hard check fails, so CI or a pre-flight script can gate on it.
 */

const base = (process.argv[2] ?? process.env.DEPLOY_URL ?? '').replace(/\/+$/, '');

if (!base || !/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/verify-deploy.mjs <https://origin>');
  console.error('   or: DEPLOY_URL=https://origin npm run verify:deploy');
  process.exit(1);
}

const isHttps = base.startsWith('https://');

/** One request, following no redirects, so a 3xx is inspected rather than chased. */
async function hit(path, { method = 'GET' } = {}) {
  const res = await fetch(base + path, { method, redirect: 'manual', headers: { 'user-agent': 'verify-deploy' } });
  return res;
}

const results = [];
const record = (level, name, detail) => results.push({ level, name, detail });
const pass = (name, detail) => record('pass', name, detail);
const fail = (name, detail) => record('fail', name, detail);
const warn = (name, detail) => record('warn', name, detail);

/** Runs one check, turning a thrown error into a failure rather than a crash. */
async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, error.message);
  }
}

async function run() {
  // 1. The home page is real, generated HTML — not the empty loading shell the
  //    old site shipped (~2.5 KB). A generous floor: real content is many times that.
  await check('home is real HTML, not a shell', async () => {
    const res = await hit('/');
    if (res.status !== 200) return fail('home is real HTML, not a shell', `expected 200, got ${res.status}`);
    const body = await res.text();
    if (body.length < 5000) {
      return fail('home is real HTML, not a shell', `only ${body.length} bytes — looks like a shell`);
    }
    pass('home is real HTML, not a shell', `${(body.length / 1024).toFixed(0)} KB`);
  });

  // 2. The security headers are actually on the response.
  await check('security headers present', async () => {
    const res = await hit('/');
    const h = res.headers;
    const missing = [];
    if (!h.get('content-security-policy')) missing.push('Content-Security-Policy');
    if (h.get('x-frame-options') !== 'DENY') missing.push('X-Frame-Options: DENY');
    if (h.get('x-content-type-options') !== 'nosniff') missing.push('X-Content-Type-Options: nosniff');
    if (!h.get('referrer-policy')) missing.push('Referrer-Policy');

    if (missing.length) return fail('security headers present', `missing: ${missing.join(', ')}`);
    pass('security headers present', 'CSP, X-Frame-Options, nosniff, Referrer-Policy');

    // HSTS is production-only and meaningful only over TLS.
    if (isHttps) {
      if (h.get('strict-transport-security')) pass('HSTS on https', h.get('strict-transport-security'));
      else fail('HSTS on https', 'Strict-Transport-Security header is absent over https');
    } else {
      warn('HSTS on https', 'target is http — HSTS is correctly not sent');
    }
  });

  // 3. The dashboard is marked do-not-index. Checked on the login page, which
  //    renders (rather than /admin, which redirects a signed-out visitor).
  await check('admin is noindex', async () => {
    const res = await hit('/admin/login');
    const tag = res.headers.get('x-robots-tag') ?? '';
    if (tag.includes('noindex')) pass('admin is noindex', tag);
    else fail('admin is noindex', `X-Robots-Tag was "${tag || '(absent)'}"`);
  });

  // 4. The admin API refuses a signed-out caller — the gate that actually
  //    protects the data. A 200 here would be a serious regression.
  await check('admin API returns 401 signed out', async () => {
    const res = await hit('/api/admin/projects');
    if (res.status === 401) pass('admin API returns 401 signed out', '401');
    else fail('admin API returns 401 signed out', `expected 401, got ${res.status}`);
  });

  // 5. An unknown (or draft) post address is a plain 404 — a draft and a
  //    non-existent post must be indistinguishable to an anonymous visitor.
  await check('unknown/draft post is 404', async () => {
    const res = await hit('/blog/verify-deploy-nonexistent-post-x9q7');
    if (res.status === 404) pass('unknown/draft post is 404', '404');
    else fail('unknown/draft post is 404', `expected 404, got ${res.status}`);
  });

  // 6. The database-driven sitemap and robots.txt respond.
  await check('sitemap.xml responds', async () => {
    const res = await hit('/sitemap.xml');
    if (res.status !== 200) return fail('sitemap.xml responds', `expected 200, got ${res.status}`);
    const body = await res.text();
    if (/<urlset|<\?xml/.test(body)) pass('sitemap.xml responds', '200, XML');
    else fail('sitemap.xml responds', '200 but body is not XML');
  });

  await check('robots.txt responds', async () => {
    const res = await hit('/robots.txt');
    if (res.status !== 200) return fail('robots.txt responds', `expected 200, got ${res.status}`);
    const body = await res.text();
    if (/user-agent|sitemap/i.test(body)) pass('robots.txt responds', '200');
    else fail('robots.txt responds', '200 but body has no robots directives');
  });

  // 7. The permanent /cv link resolves. A redirect or a 200 is success; a 404
  //    means no CV is active yet, which is a warning on a fresh deploy, not a bug.
  await check('/cv resolves', async () => {
    const res = await hit('/cv');
    if (res.status >= 200 && res.status < 400) {
      const where = res.headers.get('location');
      pass('/cv resolves', where ? `${res.status} → ${where}` : String(res.status));
    } else if (res.status === 404) {
      warn('/cv resolves', '404 — no active CV yet (upload one in the dashboard)');
    } else {
      fail('/cv resolves', `unexpected ${res.status}`);
    }
  });
}

const SYMBOL = { pass: '✓', fail: '✗', warn: '!' };

run()
  .then(() => {
    console.log(`\nVerifying ${base}\n`);
    for (const r of results) {
      console.log(`  ${SYMBOL[r.level]} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }

    const failed = results.filter((r) => r.level === 'fail').length;
    const warned = results.filter((r) => r.level === 'warn').length;

    console.log(
      `\n${results.length - failed - warned} passed, ${warned} warning(s), ${failed} failed.\n`
    );

    if (failed === 0) {
      console.log('Automated checks pass. Now do the manual half of the checklist in');
      console.log('Todo/05-deploy-to-production.md (sign-in, save-updates-page, upload).\n');
    }

    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error(`\nCould not run the checks against ${base}:`);
    console.error(`  ${error.message}\n`);
    process.exit(1);
  });
