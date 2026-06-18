# Content DOX

## Purpose

- Owns source Markdown notes and static note assets used by the Quartz build.

## Ownership

- `locked/` contains protected archive Markdown source.
- `PNGS/` contains static assets referenced by notes and copied into generated output.

## Local Contracts

- Do not move or rename note assets without updating every note reference.
- Locked note source remains plaintext in git and is encrypted only during the build pipeline.
- Missing locked-page image embeds should fail the build rather than emit broken protected pages.

## Work Guidance

- Keep frontmatter explicit for titles, weights, and locked/archive metadata.
- Avoid bulk content rewrites unless the task is specifically editorial or migration work.

## Verification

- For locked content edits, run the archive build checks when practical.
- For asset path changes, verify Quartz can resolve the referenced files.

## Child DOX Index

- No child DOX files.
