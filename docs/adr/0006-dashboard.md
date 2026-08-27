# 0006 — The dashboard: one set of components, and a provider in the wrong place

**Phase:** 6
**Status:** accepted

## Context

Phase 6 is the dashboard itself — ten screens over the API built in Phase 3, the
authentication built in Phase 4 and the uploads built in Phase 5. The brief's
requirement for the whole project is one sentence:

> I should be able to manage my portfolio content through the dashboard without
> touching the codebase.

The plan's own constraints for this phase: no new packages beyond MUI if
possible, optimistic updates with rollback, drag-to-reorder, search and filter,
loading/empty/error states, an unsaved-changes guard, keyboard navigation, and
every page guarded server-side.

## Decision

### 1. Nine screens, one implementation of each behaviour

Every list screen is a toolbar, a list, a dialog form and a confirmation. Written
once each — `ListToolbar`, `SortableList`/`DataTable`, `EntityForm`,
`ConfirmDialog` — because the tenth copy of "create, edit, publish, delete" is
where the differences appear: a required marker on six forms out of nine, an
error that renders in one place and not another, a label not associated with its
input on the two screens nobody tested with a keyboard.

What remains in each page file is the part that is genuinely about that entity: a
field list, and the row's own layout.

### 2. Forms are a field list plus the endpoint's own Zod schema

`EntityForm` takes a descriptor array and a schema imported from
`lib/validation/`, which is the same module the endpoint imports. Not a copy —
two validators drift, and the drift always surfaces as "the form accepted it and
saving failed", which reads as a broken save rather than a difference of opinion
about a field.

Client-side validation does not make the server's check redundant. The server is
the only one that counts, because anything can post to the endpoint. What the
client's copy buys is the *message*, immediately, next to the input.

Three request shapes, picked by `mode`:

- `create` — the full body, the create schema, `POST`.
- `update` — **only the changed fields**, the update schema, `PATCH`. Required by
  the API, which rejects an empty PATCH and audits what it receives; a body
  carrying every field would write a log entry claiming twelve changes when one
  was made, and would overwrite a field edited in another tab.
- `replace` — the full body, `PUT`. Singletons only.

### 3. The four pure operations live outside the components

`formValues`, `toPayload`, `changedFields` and `validateWith` are plain functions
in `lib/adminForm.js`. This is where a form is most likely to be subtly wrong — a
cleared field that silently keeps its old value, a number input whose empty state
becomes `0` because `Number('') === 0` — and none of it is visible in a
screenshot. Inside a component they would only ever be exercised by clicking.

`lib/adminList.js` is the same argument for the list surgery an optimistic update
performs, with one added rule: **nothing mutates its input**. The array handed in
is the snapshot the rollback restores, and an in-place splice would corrupt the
copy being kept for exactly that purpose — invisibly, until a request fails,
which is the moment the screen most needs to be right.

### 4. What is optimistic, and what is not

Deleting, publishing, toggling and reordering apply locally first, then send, then
roll back with a toast on failure. They are single predictable changes and the
round trip is visible on a slow connection; a row that springs back after 200 ms
feels broken.

Creating is **not** optimistic. The server derives fields the client cannot guess
— a slug, a résumé version, a reading time — so an optimistic row would appear
with the wrong values and visibly correct itself, and it would need a fake id that
could end up in a request. The form shows its own progress, which is where the
user is already looking.

Errors are reported in two different places, deliberately. `create` and `update`
throw, because they come from a form and the useful part of the failure is the
`fields` map. `patchRow`, `remove`, `publish` and `reorder` return a boolean and
toast, because they come from a row and there is nothing to render into.

### 5. `loading` is derived, not stored

The obvious version — `setLoading(true)` at the top of the fetch effect — has a
window one render wide where the query has changed and the screen still claims to
be showing current data. It also makes the effect cascade a render before doing
any work, which is what React's own lint rule objects to.

Instead the fetched state is stamped with the request it came from, and `loading`
is `stamp !== currentKey`. "Is this list for the question being asked" is then
answered by construction.

### 6. No drag library

The plan allowed for one; it turned out not to be needed. The HTML5 drag events
do the pointer half in about thirty lines, and the half a library would earn its
place for — touch support and animated reflow — is not what one admin on a desktop
reordering six rows needs.

**Every reorder is also available from the keyboard**, via ↑/↓ buttons on each
row, and those are the primary implementation with the drag layered on top rather
than the other way round. A list that can only be dragged is a list that can only
be reordered by some people. Focus follows the row that moved, so the same key can
be pressed again.

Reordering is disabled while a search or status filter is applied, and says so.
The endpoint assigns positions `0, 1, 2 …` to the ids it receives, so dragging
inside a filtered list would renumber the rows the filter is hiding.

### 7. Three screens are honest about what they cannot do yet

- **Settings** describes the rebuild control instead of offering one. On-demand
  revalidation needs `pages/api/revalidate.js` and a public site reading from the
  database — both Phase 7 — so a button would appear to work, change nothing
  visible, and read as a failed save.
- **Overview** says "last rebuild: not tracked yet" rather than showing a
  plausible timestamp.
- **Blog** lists, publishes and deletes posts but does not write them. Writing
  needs a Markdown editor with a preview, which is Phase 8; a bare `<textarea>`
  labelled "content" would be a worse version of something already planned, and
  would then have to be removed.

Tags *are* fully managed there, because the Phase 8 editor needs them to exist,
and because they are created deliberately rather than typed into a post — a
free-text tag field produces "nextjs", "Next.js" and "next-js", and the join table
makes cleaning that up everyone's problem.

### 8. Styling: Tailwind for what we build, the MUI theme for what ships its own

`tailwind.config.js` sets `important: true`, so every Tailwind utility carries
`!important` and beats MUI's emotion classes. The plan flagged that as a risk and
proposed moving admin styling to MUI's `sx`. What was actually done splits by
which system owns the element:

- Hand-built controls — inputs, buttons, panels — are Tailwind, because the public
  site is Tailwind and the Phase 4 login form already was. The class strings had
  been copied between three files by Phase 5, and one copy had already lost its
  focus style; they are now named once in `lib/adminTheme.js`.
- Components that ship their own stylesheet — Dialog, Snackbar, Tooltip — are left
  entirely to the MUI theme, which is small and exists because those render in
  MUI's default *light* palette otherwise: a white box on a `#141e30` page.

The two are not mixed on one element, which is where `important: true` would bite.

Every colour in `lib/adminTheme.js` already existed in the repository. The
dashboard is a back room of the same building, not a second product.

## Consequences

- Ten server-rendered pages, all guarded, all `noindex`.
- The dashboard's data is fetched after mount, so the server-rendered markup is
  the chrome plus each screen's loading state. That is the design: the lists
  change while you look at them, and the Overview — which does not — is
  server-rendered in a single pipelined transaction instead.
- `lib/passwordPolicy.js` was split out of `lib/password.js` so the change-password
  form can apply the identical rule without pulling bcryptjs into the browser
  bundle. `lib/password.js` re-exports it; no existing import changed.
- `GET /api/admin/account` gained `linkedProviders`, without the
  `providerAccountId` — the dashboard has no use for it, and a value with no use
  is a value that only has downsides if it leaks.

## Two bugs worth recording

### The provider was below the code that needed it

`AdminLayout` rendered `ThemeProvider` and `ToastProvider` around its children.
Every screen renders `AdminLayout` **from its own body**:

```js
function SkillsScreen() {
  const skills = useResource(…)          // ← runs here, in the parent
  return <AdminLayout>…</AdminLayout>    // ← provider mounts here, below it
}
```

A provider rendered *by* a component is not available *to* that component. So
every screen that fetched anything threw `useToast must be used inside
<ToastProvider>` on its first render, and the only page that worked was the
Overview — the one screen that fetches nothing.

Nine of ten screens returned 500 and it was not caught by the lint pass, the
build, or 419 unit tests. It was caught by rendering the pages against a running
server, which is the only thing that could have: the components are JSX in `.js`
files and cannot be imported by the test runner (see below).

The fix is `adminScreen(Component)` — a wrapper around the whole page component,
so the providers sit above it. Not `pages/_app.js`, which is shared with the
public site and would ship MUI's Snackbar and the admin theme to every visitor to
serve one person. Forgetting the wrapper is loud, and `tests/adminPages.test.js`
asserts every page uses it.

### An empty slug field was posting an empty string

`slug()` requires at least one character, and the endpoint derives a slug from the
title when the field is **absent**. The form sent `''` for an untouched slug, so
creating a project without inventing a URL failed with "Required." on a field the
user had deliberately left blank.

Omission is the only value that means "you decide", so `toPayload` now drops an
empty slug rather than sending it. The same rule makes clearing the slug on an
existing record mean "leave it alone", which is what the endpoint already does and
the right behaviour for a URL that may already be public.

## What is verified, and what is not

A throwaway script drove the running dev server against the live database — **123
checks, all passing** — covering: every screen redirecting when signed out and
rendering when signed in; the return path in the redirect; the API answering 401
rather than redirecting; no password hash in any page's markup and `adminUser` in
props being exactly the six-field allowlist; every entity created, edited,
reordered, published, unpublished and deleted through the same request bodies the
forms build; the rejections that have to reach a specific input (a duplicate name,
a graduation year before the start year, a current role with an end date, an icon
the site has no component for, a `javascript:` URL, an immutable section key); the
CV flow end to end including `/cv` 404ing and then redirecting; and each screen's
client bundle actually shipping its interactive code.

**Not verified: the browser.** Post-mount fetching, optimistic rollback, the drag
interaction, focus behaviour in the dialogs and the layout at tablet width have
been reasoned about and built for, but not observed. Two things stand in the way,
and both are worth stating rather than glossing:

- There is no browser automation available in this environment.
- The components cannot be unit-tested either. Every component in this project is
  JSX inside a `.js` file — Next's convention, and how this repository was already
  written — and Vite transforms `.jsx` and `.ts(x)` but leaves `.js` alone. The
  ways round it are a new dependency (`@vitejs/plugin-react`) or renaming sixteen
  files, and neither is a decision to make quietly at the end of a phase.

So the pure logic is unit-tested (`adminForm`, `adminList`, `adminClient`,
`adminFormat`, `adminPage` — 143 assertions), the first render and every request
are verified against a real server, and the interaction layer rests on review.
That gap is the honest state of this phase, and the cheapest way to close it is a
manual pass through the ten screens.
