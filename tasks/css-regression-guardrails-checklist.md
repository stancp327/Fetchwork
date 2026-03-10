# Phase 5 — CSS Regression Guardrails Checklist (Fetchwork)

**Purpose:** Prevent responsive regressions and “silent CSS failures” (undefined tokens, unintended global collisions).

**When to run:**
- Before every CSS-focused commit
- Before every deploy that touches client CSS
- After any UI/UX bugfix that touches layout

**Required viewports:**
- Mobile: **375px**
- Tablet: **768px**
- Desktop: **1280px**

Fetchwork breakpoints: `480px`, `768px`, `1024px`, `1280px` (mobile-first, **min-width only**).

---

## 1) Diff hygiene (keep PRs reviewable)
- [ ] `git diff --stat` shows only intended files.
- [ ] No unrelated server/infra changes bundled with CSS.

---

## 2) Hard bans (must be zero unless explicitly justified)
### Media queries
- [ ] **No** `@media (max-width: ...)` anywhere (desktop-first is banned).
  - Search: `@media (max-width`.

### Star selectors
- [ ] No `*` selectors for layout hacks.
  - Allowed only for reset patterns (box-sizing, etc.).

### Overflow clipping
- [ ] No new `overflow: hidden` without verifying there are no children with:
  - negative margins, absolute positioning, or intentional overlap.

### Flex/grid shrink bugs
- [ ] No global `min-width: 0` changes.
- [ ] Every grid template using fractional tracks uses `minmax(0, 1fr)` (not plain `1fr`).

---

## 3) Token sanity (prevents silent broken CSS)
**Rule:** No `var(--token)` usage unless the token exists.

- [ ] For each edited CSS file, list every `var(--...)` and confirm it exists in:
  - `client/src/styles/tokens.css`
- [ ] No legacy token names (examples):
  - `--text-*`, `--primary-color`, `--border-light`, `--background-*`

---

## 4) Collision guardrails (avoid global selector landmines)
**Rule:** Generic classnames must be scoped or promoted.

Examples of risky generic selectors:
- `.stat`, `.rating`, `.reviews`, `.feature`, `.search-input`

For each generic selector:
- [ ] Either scope it under a parent container (preferred), e.g. `.freelancer-card .stat`
- [ ] Or promote it to `client/src/styles/shared.css` as a true primitive

---

## 5) Responsive layout sweep (must pass at 375/768/1280)
For each viewport, verify:
- [ ] No horizontal scroll (try to scroll sideways)
- [ ] Fixed nav does not overlap content (top padding includes nav height)
- [ ] Typography wraps (no clipped headings/badges/tags)
- [ ] Touch targets are ≥ 44px for interactive elements
- [ ] Tables have a mobile card layout or do not overflow

**Priority pages to test (default):**
- [ ] Browse Services
- [ ] Service Details
- [ ] Post Job
- [ ] Job Details
- [ ] Dashboard / Profile

---

## 6) Forms checklist
- [ ] Inputs/selects/textarea: ≥ 44px height on touch devices
- [ ] iOS Safari: tapping inputs does **not** trigger zoom (font-size ≥ 16 on coarse pointer)
- [ ] Validation messages don’t cause sideways overflow
- [ ] Multi-column form rows collapse to 1 column on mobile

---

## 7) Commit gate (Definition of Done)
Before marking a CSS task “done”:
- [ ] Run the searches in sections 2–4
- [ ] Manual sweep section 5 (or automated screenshots if tooling is stable)
- [ ] Write a short change note:
  - What changed
  - Why
  - Which viewports were verified

---

## Notes / Utilities
Suggested one-liners (PowerShell examples):
- Search banned max-width MQs:
  - `Select-String -Path client/src/**/*.css -Pattern "@media (max-width"`
- Search overflow hidden:
  - `Select-String -Path client/src/**/*.css -Pattern "overflow:\s*hidden"`

(Prefer putting these into a dedicated script later if we want a true “one command” QA runner.)
