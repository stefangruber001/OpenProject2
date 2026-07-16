# Security policy

## Reporting a vulnerability

If you find a security issue, **do not open a public issue**. Email the
maintainers directly and give us a reasonable window to fix it before any public
disclosure. We'll acknowledge, investigate, and keep you updated.

## How we keep things secure

- **Secrets never live in the repo.** Configuration comes from environment
  variables; `.env` is git-ignored. Only `.env.example` (with placeholder values)
  is committed.
- **Dependencies are watched.** Dependabot proposes updates weekly; GitHub secret
  scanning is enabled on the repository.
- **`main` is protected.** All changes go through a reviewed pull request that
  must pass CI.
- **Least privilege.** Access to production systems and secrets is limited to who
  needs it.

## Handling personal data

If the product handles personal data of EU users, we treat it as subject to
**GDPR**: collect only what we need, keep it exportable and deletable, and never
log secrets or sensitive personal data. Data-model and processing decisions that
affect privacy should be captured in an ADR.
