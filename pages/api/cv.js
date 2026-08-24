import { prisma } from '@/lib/prisma';

/**
 * `GET /cv` — a permanent, shareable link to the current CV.
 *
 * Deliberately **not** built with `createHandler`: this is the one route under
 * `pages/api` that is meant to be public, and using the admin wrapper would 401
 * every visitor. Written out longhand so that being public is a visible choice
 * rather than a missing import.
 *
 * The point of the indirection is that the URL never changes. Uploading a new CV
 * activates a new `Resume` row pointing at a new storage object, and every link
 * anyone has ever shared — on a CV, in an email, on LinkedIn — keeps working and
 * starts serving the new file.
 */
export default async function cv(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: { message: `${req.method} is not allowed here.` } });
    return;
  }

  const active = await prisma.resume.findFirst({
    where: { isActive: true },
    select: { media: { select: { url: true } } },
  });

  if (!active?.media?.url) {
    // Not cached: the moment a CV is activated, this must stop being a 404.
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({
      error: { message: 'No CV is published yet.' },
    });
    return;
  }

  /**
   * A short shared cache, and none in the browser.
   *
   * `s-maxage=60` keeps the CDN from asking the database on every click, while
   * `max-age=0` means a visitor who saved the link is never handed a stale
   * redirect from their own cache — the far more confusing of the two failures,
   * because clearing someone else's browser cache is not an option.
   *
   * 302, not 301: a permanent redirect is cached indefinitely by browsers and
   * would pin the link to whichever CV was active the first time it was clicked.
   */
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.redirect(302, active.media.url);
}
