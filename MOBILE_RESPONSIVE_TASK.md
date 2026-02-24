# Mobile Responsive Overhaul — Task Brief

## Project
- **Repo:** C:\Users\stanc\Fetchwork
- **Stack:** React 18 + plain CSS (no Tailwind, no CSS modules)
- **Existing design system:** `src/styles/tokens.css` (CSS custom properties) + `src/styles/utilities.css`
- **40+ CSS files**, 60+ components
- **Current approach:** Desktop-first (84 `max-width` media queries, only 4 `min-width`)

## Problem
The site is not mobile responsive. Root cause: desktop-first CSS with ad-hoc `max-width` media queries bolted on. Breakpoints are inconsistent (768, 480, 640, 900, 1024, 1100, 380, 600 — all used arbitrarily).

## Goals (non-negotiable)
1. Mobile-first layout everywhere (start at 360px width)
2. No horizontal scrolling on any page (ever)
3. Typography scales properly (no tiny text, no oversized headings)
4. Touch targets ≥ 44px height/width
5. Nav and critical actions usable one-handed
6. Forms and modals fully usable on mobile (keyboard safe)
7. Responsive at: 360 / 390 / 414 / 768 / 1024 / 1280+
8. No layout shift, lightweight animations

## Implementation Plan

### Phase 1: Responsive Foundation (DO THIS FIRST)

#### 1a. Update `src/styles/tokens.css`
- Replace font-size tokens with fluid `clamp()` values:
  ```css
  --font-size-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem);
  --font-size-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem);
  --font-size-base: clamp(0.875rem, 0.825rem + 0.25vw, 1rem);
  --font-size-lg: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --font-size-xl: clamp(1.125rem, 1rem + 0.5vw, 1.25rem);
  --font-size-2xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --font-size-3xl: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);
  --font-size-4xl: clamp(1.75rem, 1.3rem + 2vw, 3.5rem);
  ```
- Add container tokens:
  ```css
  --container-max: 1200px;
  --container-padding: clamp(1rem, 2vw, 2rem);
  ```
- Standardize breakpoints (reference only, use in media queries):
  ```css
  /* Breakpoints: 480px (sm), 768px (md), 1024px (lg), 1280px (xl) */
  ```

#### 1b. Add responsive layout primitives to `src/styles/utilities.css`
```css
/* Container */
.container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding-left: var(--container-padding);
  padding-right: var(--container-padding);
}

/* Page wrapper */
.page-wrapper {
  padding-top: var(--space-lg);
  padding-bottom: var(--space-3xl);
  min-height: calc(100vh - 64px);
}

/* Responsive grid */
.grid { display: grid; gap: var(--space-lg); }
.grid-1 { grid-template-columns: 1fr; }
.grid-2 { grid-template-columns: 1fr; }
.grid-3 { grid-template-columns: 1fr; }

@media (min-width: 480px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 768px) {
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
}

/* Stack (vertical on mobile, horizontal on desktop) */
.stack { display: flex; flex-direction: column; gap: var(--space-lg); }
@media (min-width: 768px) {
  .stack-row { flex-direction: row; }
}

/* Sidebar layout (sidebar + main) */
.layout-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
@media (min-width: 768px) {
  .layout-sidebar {
    flex-direction: row;
  }
  .layout-sidebar > .sidebar {
    width: 280px;
    flex-shrink: 0;
  }
  .layout-sidebar > .main {
    flex: 1;
    min-width: 0;
  }
}

/* Hide/show at breakpoints */
.hide-mobile { display: none; }
@media (min-width: 768px) { .hide-mobile { display: initial; } }
@media (min-width: 768px) { .hide-desktop { display: none; } }

/* Overflow protection */
.overflow-wrap { overflow-wrap: break-word; word-break: break-word; }
img, video, svg { max-width: 100%; height: auto; }
```

#### 1c. Add global reset to `src/index.css`
```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { overflow-x: hidden; }
img, video, svg { max-width: 100%; height: auto; }
input, button, textarea, select { font: inherit; }
button, [role="button"] { min-height: 44px; min-width: 44px; }
```

### Phase 2: Navigation
- File: `components/Navigation/Navigation.js` + `Navigation.css`
- Already has hamburger menu — verify it works properly
- Ensure menu is scrollable if tall
- Ensure notification dropdown works on mobile
- Test at 360px

### Phase 3: Page-by-page refactor
For each page, convert from desktop-first to mobile-first:
1. Remove all `max-width` media queries
2. Write base styles for mobile (360px)
3. Add `min-width` media queries to enhance for larger screens
4. Replace any `width: XXXpx` with fluid alternatives
5. Ensure cards go 1-col on mobile, 2 on tablet, 3+ on desktop

**Priority order (highest traffic pages first):**
1. `Home.css` — landing page, first impression
2. `Dashboard.css` — main user hub
3. `BrowseLayout.css` — shared layout for Browse Jobs/Services
4. `JobCard.css` — used everywhere
5. `JobDetails.css` + `PostJob.css`
6. `ServiceDetails.css` + `CreateService.css`
7. `Profile.css` + `PublicProfile.css`
8. `Messages.css` — needs single-pane on mobile
9. `Auth.css` — Login/Register/Forgot
10. `Navigation.css` — hamburger menu
11. `Payments.css`
12. `Reviews.css`
13. Admin pages (AdminDashboard, AdminDisputeDetail, AdminDisputePanel, AdminEmailPanel)
14. `DisputeCenter.css` + `DisputeDetail.css` + `DisputeFilingForm.css`
15. `ProjectManagement.css` + `JobProgress.css`
16. `CustomOffer.css` + `ProposalWizard.css`
17. `Wizard.css` (Onboarding)
18. `UniversalSearch.css`
19. `SavedItems` (uses BrowseLayout)
20. `Footer.css`

### Phase 4: Verification
After all changes:
- No horizontal scrolling at 360px, 390px, 414px, 768px, 1024px, 1280px
- All forms usable on mobile
- All modals full-screen on mobile with reachable close button
- Touch targets ≥ 44px
- Typography readable at all sizes

## Rules
- **Do NOT patch pages individually before the responsive system (Phase 1) is done**
- **Mobile-first means base styles = mobile, then `min-width` queries to enhance**
- **Never use `max-width` media queries** (except for edge cases with comment explaining why)
- **All containers must use `max-width` + `width: 100%` + `margin: 0 auto` + padding**
- **Test every change mentally at 360px width**
- Commit after each phase with descriptive message
- Push to main after each phase

## Files to create/modify
- `src/styles/tokens.css` — update typography + add container tokens
- `src/styles/utilities.css` — add layout primitives
- `src/index.css` — add global reset
- All 40+ component CSS files — refactor to mobile-first
- Component JS files only if layout structure needs changing (add wrapper divs, etc.)
