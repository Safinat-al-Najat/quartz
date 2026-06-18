# Quartz Repo DOX

## Purpose

- Owns the customized Quartz static site, locked archive encryption build pipeline, content assets, and generated public output.

## Ownership

- Root config files such as `quartz.config.ts`, `quartz.layout.ts`, `package.json`, and `encrypt-archive.js` own build, layout, and archive behavior.
- `quartz/` owns Quartz framework customizations.
- `content/` owns source notes and static assets copied into the site.
- `docs/` tracks upstream Quartz documentation.
- `public/` and `.quartz-cache/` are generated build state.

## Local Contracts

- Locked archive plaintext must never leak into generated search/content indexes.
- `archive-config.json` is a local/build password fallback and must not be treated as a safe public secret store.
- Keep `Plugin.Assets()` and `Plugin.Static()` registered once each.
- Layout widgets that expose public navigation or recency lists must not surface locked vault pages unless the runtime has a deliberate unlock flow for that surface.

## Work Guidance

- Prefer focused utilities under `quartz/util/` for reusable Quartz predicates or behavior.
- Add regression tests for locked-vault, search-index, or navigation visibility changes.
- Do not edit `public/`, `.quartz-cache/`, or `content/PNGS/` for code changes unless the task is specifically about generated output or assets.

## Verification

- Focused tests: `npm test -- <path-to-test>` from this folder.
- Type/config check: `npm run check`.
- Build verification: `npm run build` when archive generation or Quartz emitters change.

## Child DOX Index

- `quartz/AGENTS.md` - Quartz framework custom components, processors, plugins, styles, and utilities.
- `content/AGENTS.md` - source notes and copied static assets.
