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
