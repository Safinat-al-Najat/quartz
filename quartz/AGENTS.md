# Quartz Framework DOX

## Purpose

- Owns customized Quartz framework code used to render and protect the Safinat al-Najat site.

## Ownership

- `components/` owns page widgets, their styles, and browser scripts.
- `plugins/`, `processors/`, `util/`, `i18n/`, `styles/`, and `cli/` follow Quartz framework responsibilities.

## Local Contracts

- Browser scripts must be safe across hard reloads and Quartz navigation events.
- Markdown frontmatter parsing must tolerate non-object YAML/TOML results and fall back to file-derived defaults instead of crashing the build.
- Locked-page runtime behavior must match the parent workspace contract at `architecture/locked-vault-security.md`.
- Shared predicates used by layout/config should live in `util/` with focused tests.

## Work Guidance

- Preserve Quartz TypeScript, Preact JSX, and component-constructor conventions.
- Use type-only imports for type-only dependencies.
- Keep user-facing locked-vault behavior covered by focused tests before broad refactors.

## Verification

- Run focused `npm test -- quartz/...` tests from `quartz-repo/`.
- Run `npm run check` before broad Quartz framework changes.

## Child DOX Index

- `components/AGENTS.md` - Quartz UI components, styles, and inline browser scripts.
