# Flash Chat — Dependency Management & Security Policy

This document establishes the dependency update schedule, review process, and security patching guidelines for Flash Chat.

---

## 1. Automated Dependency Schedules

- **Dependabot / Automated PRs**: Scans occur **weekly** for root, client, server, Docker, and GitHub Actions ecosystems.
- **Grouped PRs**: Minor and patch updates are automatically grouped to minimize CI load.
- **Critical Security Patches**: Triggered immediately upon publication of high/critical CVEs.

---

## 2. Review & Quality Gates for Dependency PRs

Every dependency upgrade PR must pass all standard automated quality gates prior to merging:
1. `npm run docs:check`
2. `npm --prefix client run lint:tokens`
3. `npm --prefix client run lint:brand`
4. `npm --prefix client run test:a11y`
5. `npm --prefix server test`
6. `npm --prefix client test`
7. Bundle budget gate: Main application chunk must remain `< 250 KB gzip`.

---

## 3. Framework & Major Version Policy

- Major version upgrades (e.g. React 19, Express 5, Mongoose 9) are **never** auto-merged.
- Major upgrades require a dedicated architectural RFC, migration testing branch, and benchmark verification.
