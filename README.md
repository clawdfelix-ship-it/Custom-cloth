# Zenex Sports Custom

A browser-based football kit creator: design shirts, shorts and socks in a
3D preview, then export texture-ready kit archives.

## Features

- **3D preview** — procedural garment geometry (torso, sleeves, 26 collar
  variants) rendered with Three.js.
- **Layered 2D renderer** — produces the colour, normal, coefficient and TAA
  maps for shirt, shorts and socks.
- **ZIP export** — exports the same file set the game texture pipeline
  expects: `<area>_color.png`, `<area>_normal.png`, `<area>_coeff.png`,
  `<area>_taa.png`, `settings.json` and (for paid members)
  `hotspots.hotspot`.
- **Hotspot editor** — place crest, sponsor and brand markers by clicking the
  garment in the 3D view.
- **Saved kits** — persist kits, colour presets, and publish to the public
  showcase.
- **Membership tiers** — free, tier 1 and tier 2 gate the paid features.

## Stack

| Layer      | Choice                                       |
| ---------- | -------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript |
| Styling    | Tailwind CSS v4                               |
| 3D         | Three.js                                      |
| Export     | Canvas 2D + JSZip                             |
| Database   | PostgreSQL (Neon in production, local Postgres in dev) |
| ORM        | Prisma 7 with a driver adapter                |
| Auth       | Self-contained JWT session (jose) + bcrypt     |

## Getting started

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL and SESSION_SECRET
npx prisma migrate dev  # create the schema
npm run dev
```

The database driver is chosen from the connection string host: `*.neon.tech`
uses the Neon serverless driver, anything else uses `node-postgres`. That
means local development works against a Homebrew Postgres without extra
configuration while production uses Neon.

## Environment

| Variable            | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string                       |
| `SESSION_SECRET`    | Signing key for the session cookie (32+ chars)     |
| `NEXT_PUBLIC_APP_URL` | Public origin, used for absolute URLs            |
| `RESEND_API_KEY`    | Optional. Without it, 2FA codes log to the console |
| `MAIL_FROM`         | Sender address for 2FA emails                      |
| `PLATFORM_ADMIN_EMAILS` | Comma list allowed to change member tiers       |

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run db:migrate # apply migrations
npm run db:push    # push schema without a migration
```

## Export format

`settings.json` carries the garment colours, fit, shorts style and number
layout. `hotspots.hotspot` carries the crest/sponsor/brand markers with their
bounds and rotation. Both are plain JSON so they can be inspected and
diffed.
