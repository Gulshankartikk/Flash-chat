## Pull Request Description
<!-- Provide a concise summary of the change, motivation, and context. -->

## Quality & Security Checklist
- [ ] Added or updated automated unit/integration tests
- [ ] Ran `npm run docs:check` (0 errors)
- [ ] Verified Design System token strictness: `npm --prefix client run lint:tokens`
- [ ] Verified Flash AI branding: `npm --prefix client run lint:brand`
- [ ] Accessibility verified: `npm --prefix client run test:a11y`
- [ ] Production bundle budget respected (Main app chunk < 250 KB gzip)
- [ ] Migration idempotency & rollback plan verified (if touching database schema)
- [ ] No secrets or sensitive PII included in logs or client bundles
