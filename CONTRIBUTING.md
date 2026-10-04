# Contributing to Flash Chat

Thank you for contributing to Flash Chat! Please follow these standards and guidelines.

---

## 1. Quality Gates & PR Requirements

Before opening a Pull Request, verify that all local checks pass:

```bash
# 1. Run root verification
npm run docs:check

# 2. Run client checks & linters
npm --prefix client run lint:tokens
npm --prefix client run lint:brand
npm --prefix client run test:a11y
npm --prefix client test

# 3. Run server test suites
npm --prefix server test

# 4. Verify bundle budget (< 250 KB gzip)
npm --prefix client run build
```

---

## 2. Design System Tokens Rule

- Use **only** semantic tokens defined in [client/src/styles/tokens.css](file:///client/src/styles/tokens.css) (`cream`, `card`, `primary`, `secondary`, `accent`, `ink`, `muted`, `line`, `brand`).
- Do **not** introduce arbitrary Tailwind color utilities (e.g. `emerald-*`, `indigo-*`, `slate-*`).

---

## 3. Flash AI Branding Rule

- Visible AI references must always be **"Flash AI"**.
- The word "Gemini" is strictly restricted to the explicit `AiProviderDisclosure` component and backend adapter identifiers.
