# Managing your site's content

This is the everyday guide: how to change what your site shows, in plain language.
Everything here happens in the dashboard at **`/admin`** — you never edit code or
touch the database directly.

## The basics, once

- **Signing in.** Go to `/admin`. Sign in with Google or with your email and
  password. Only addresses on the allowlist can get in; if you ever can't, that is
  usually why.
- **Saving is instant-ish.** When you save, the public page rebuilds itself. Give
  it a few seconds and reload the real page — your change is there. You do not
  deploy anything.
- **Draft vs Published.** Most things have a status. **Draft** means only you can
  see it (it is not on the public site and not findable by its address).
  **Published** means it is live. A new post starts as a draft on purpose — nothing
  goes public by accident.
- **"Unsaved changes."** If you edit and try to leave without saving, the page
  warns you. That is deliberate.
- **Images need alt text.** When you add an image, describe it in the "alt text"
  box — it is what a screen reader reads, and the site asks for it once you attach
  a cover. A sentence is plenty.

## Where each thing lives

| You want to change… | Go to |
|---|---|
| Your name, headline, the About paragraph, education | **Bio** |
| Jobs and contract roles | **Experience** |
| Portfolio projects and their cover images | **Projects** |
| Your skills list and its order | **Skills** |
| Social links (LinkedIn, GitHub, …) | **Links** |
| Your CV / résumé file | **CV** |
| Blog posts and their tags | **Blog** |
| Page titles, the search-engine description, section headings | **Settings** |
| Your password and linked sign-in methods | **Account** |

## Bio

Your identity block and your education.

- The greeting, name, headline and About paragraph are single fields — edit and
  save.
- **Education** is a list you can add rows to and reorder. Each row can be a draft
  while you are still writing it; publish it to show it.

## Experience

Your work history, split into two tabs — **Full-time** and **Contract** — over one
list. Add a role, fill in the title, company, dates and description, and set it to
Published to show it. Drag to reorder within a tab. If a date range shows an odd
dash, there is a "timeline override" field to type the exact text you want.

## Projects

Your portfolio.

- Each project has a title, description, links, and a **cover image** you upload.
- The **featured** flag controls whether it also appears on the home page's
  highlights.
- Reorder by dragging; the order you set is the order visitors see.
- Set Published to show a project; keep it Draft while it is unfinished.

## Skills

A simple list, shown in the order you arrange. Add a skill, drag it into place,
publish. Removing a skill takes it off the site.

## Links

Your social links. Each one has a URL and a choice of **where it appears** (for
example the header, the contact section, or both). Only `http`/`https` links are
accepted.

## CV

Your résumé, as versioned uploads.

- Upload a new PDF and **make it active**. The public link **`/cv`** always points
  at whichever version is active — so replacing your CV is just an upload, and
  every link you have already shared (email signature, LinkedIn) keeps working and
  now shows the new file.
- Old versions stay in the list; you can re-activate a previous one if you need to.

## Blog

Two things live here: **posts** and **tags**.

### Writing a post

1. On the **Blog** screen, click **Write a post** (or **edit** on an existing one).
2. Fill in the **title** and write the body in **Markdown**. The editor has
   **Write / Preview / Split** — the preview is exactly what the published page
   will look like, including that anything unsafe (like a pasted `<script>`) is
   stripped out.
3. Optionally set a **cover image**, a **share image** (used when the link is
   posted to social media — it falls back to the cover), an **excerpt** (the
   summary on the blog card), and **SEO title/description**.
4. Pick any **tags** by clicking them. Tags must be created first (below) so a typo
   can't create a near-duplicate.
5. **Save draft** keeps it private. **Save and publish** puts it live. The web
   address (the "slug") is made from the title; you can set it yourself, but
   changing it later breaks links people have already shared.

Publishing a post you later unpublish keeps its original date, so re-publishing
doesn't shove it to the top of the blog.

### Tags

Create tags on the **Blog** screen (in the Tags panel) before using them on a post.
Deleting a tag only removes the label from posts — it never deletes the posts.

## Settings

Two things:

- **SEO defaults** — the site title, the default description search engines show,
  your canonical URL and Twitter handle.
- **Section headings** — the labels and numbers of the home-page sections (About,
  Skills, Experience, …). These also drive the navigation menu. A "Blog" link
  appears automatically once you have published at least one post.

There is also a manual **rebuild** button here, for the rare case where a save's
automatic rebuild didn't take.

## Account

Change your password, see which sign-in methods (Google, password) are linked, and
review your recent sign-ins. If you forget your password and can't get in, recovery
is a command someone runs on your behalf (`npm run admin:reset-password`) — there
is no reset-by-email.

## A few things that are deliberately not editable here

- **The images the theme itself uses** (the logo, the favicon) live in the code,
  not the dashboard.
- **Anyone's access.** Who can sign in is the `ADMIN_EMAILS` setting on the server,
  not something in the dashboard — that is what keeps it safe.
- **Deleting vs unpublishing.** If you just want something off the site, prefer
  **unpublish** over **delete**. Unpublishing is reversible and keeps the dates;
  delete is permanent.
