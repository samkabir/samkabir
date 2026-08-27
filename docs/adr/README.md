# Architecture decision records

One file per decision that a future reader could reasonably have made
differently, and would otherwise have to reverse-engineer from the code.

Each records the context, the decision, the consequences, and — the part that
usually gets lost — what was rejected and why.

| # | Decision | Phase |
|---|---|---|
| [0001](0001-orm-and-prisma-version.md) | Prisma as the ORM, pinned to v6 | 2 |
| [0002](0002-database-schema.md) | Database schema decisions | 2 |
| [0003](0003-admin-api.md) | Admin API: one handler pattern, guarded by construction | 3 |
| [0004](0004-authentication.md) | Authentication: three gates, no registration path | 4 |
| [0005](0005-file-storage.md) | File storage: bytes decide the type, and deletion order matters | 5 |
| [0006](0006-dashboard.md) | The dashboard: one set of components, and a provider in the wrong place | 6 |
| [0007](0007-public-site-rendering.md) | Public site rendering: static generation with on-demand revalidation | 7 |
| [0008](0008-blog-and-markdown.md) | The blog, and the Markdown sanitisation pipeline | 8 |
| [0009](0009-security-headers.md) | Security headers, and the CSP that keeps `'unsafe-inline'` | 9 |
