# Quartz Components DOX

## Purpose

- Owns Quartz UI components, component styles, and inline scripts rendered into the static site.

## Ownership

- Top-level `.tsx` files own component markup and registration.
- `scripts/` owns browser runtime behavior attached through component resources.
- `styles/` owns component SCSS.

## Local Contracts

- Locked archive UI must render a usable password gate on locked pages and must not create dead blank states.
- Component scripts must tolerate missing optional DOM nodes and repeated navigation events.
- Public widgets such as recent notes should avoid exposing locked-vault pages unless explicitly designed to unlock them.

## Work Guidance

- Keep component changes small and pair runtime behavior changes with tests where existing harnesses allow it.
- Prefer existing component and style patterns over new framework dependencies.

## Verification

- Run focused component or script tests from `quartz-repo/`.
- For rendered behavior changes, build or browser-test the affected page when practical.

## Child DOX Index

- No child DOX files.
