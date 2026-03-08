# 20_CSS_STRUCTURE.md
*Audit date: 2026-03-07 | Agent: SCOUT-CSS | Repo: C:\Users\stanc\Fetchwork*

---

## Summary

Fetchwork's CSS is **architecturally sound at the foundation layer** (tokens → shared → utilities → components) but has accumulated significant inconsistency in component files. The token system is well-designed but not consistently enforced — 1,271 hardcoded color instances exist in component CSS alongside perfectly good CSS variables that cover the same values. The biggest structural risks are: `TeamDetail.js` embedding 107 inline styles with no CSS file, `btn-primary` being redefined in 4 component files (conflicts with `shared.css`), and `--color-accent` being referenced but never defined (silent failure).

**Overall grade: C+ — Good bones, messy rooms.**

| Metric | Value |
|---|---|
| Total CSS files | 94 |
| Total CSS lines (approx) | ~48,000 |
| CSS variables defined | 95 tokens in `:root` |
| Hardcoded color instances | **1,271** |
| Inline style={{ in JSX | **513** |
| !important usage | 5 (low — acceptable) |
| Mobile-first compliance | **87%** (106 min-width vs 16 max-width) |
| Files with scoped prefixes | 71 / 89 component files |
| Undefined CSS vars in use | **2** (`--color-accent`, `--color-text-primary`) |

---

## Architecture Overview

### File Structure

```
client/src/
├── index.css                    ← Global entry point (imports tokens, shared, utilities)
├── App.css                      ← App shell (.App, .page-content, .loading-spinner)
├── styles/
│   ├── tokens.css               ← ✅ CSS custom properties (:root — 95 vars)
│   ├── shared.css               ← ✅ Canonical primitives (.btn, .card, .badge, forms)
│   └── utilities.css            ← ✅ Utility classes + responsive grid system
└── components/
    └── [Feature]/[Component].css  ← 89 component-scoped CSS files
```

**Load order in index.css:**
```css
@import './styles/tokens.css';   /* Stage 1: design tokens */
@import './styles/shared.css';   /* Stage 2: shared primitives */
@import './styles/utilities.css'; /* Stage 3: utilities + layout */
/* Component CSS imported per-component in JS files */
```

This is a **well-designed cascade**. The intent is clear and the layering is correct.

### Naming Conventions

**Mixed — no single convention enforced.** Observed patterns:

| Pattern | Example | Files Using It |
|---|---|---|
| Short component prefix (dominant) | `.pm-container`, `.auc-card`, `.jp-header` | 71 / 89 files |
| Descriptive class names | `.messages-page`, `.profile-page` | ~10 files |
| Generic utility names (collision risk) | `.btn`, `.form-group`, `.step`, `.modal` | 8 files |
| BEM-adjacent | `.nav-primary-link`, `.nav-brand` | Navigation.css |

**71 of 89 component files** use short scoped prefixes (2–4 char abbreviation + hyphen, e.g., `pm-` for ProjectManagement, `auc-` for AdminUserCard). This is a good convention but is **informal and undocumented** — 18 files skip it entirely.

**Files NOT using scoped prefix convention:**
`PricingPage.css`, `UpgradePrompt.css`, `WalletPage.css`, `AvailabilitySettings.css`,
`BoostCheckout.css`, `IncomingCallOverlay.css`, `VideoCallModal.css`, `Footer.css`,
`LoadingSkeleton.css`, `OnlineStatus.css`, `Toast.css`, `DisputeCenter.css`,
`DisputeTimeline.css`, `OnboardingMilestone.css`, `Wizard.css`, `SavedItems.css`,
`UniversalSearch.css`, `EmailPreferences.css`

### CSS-in-JS / Styled Components / Tailwind

**None.** Pure CSS files only. No SCSS, no LESS, no CSS Modules. Zero styled-components or emotion imports detected. Good — this is intentional and consistent.

---

## CSS Variable System (Complete List)

All 95 custom properties defined in `client/src/styles/tokens.css` under `:root`.

### Layout
```css
--nav-height: 64px
--container-max: 1200px
--container-padding: clamp(1rem, 2vw, 2rem)
--breakpoint-sm: 480px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
```

### Brand Colors
```css
--color-primary: #2563eb
--color-primary-dark: #1d4ed8
--color-primary-light: #eff6ff
--color-primary-bg: #dbeafe
--color-primary-disabled: #93c5fd
--color-primary-ring: rgba(37, 99, 235, 0.2)
```

### Semantic Colors
```css
--color-success: #10b981
--color-success-dark: #059669
--color-success-light: #ecfdf5
--color-danger: #dc2626
--color-danger-dark: #b91c1c
--color-danger-light: #fee2e2
--color-danger-subtle: #fef2f2
--color-warning: #f59e0b
--color-warning-dark: #d97706
--color-warning-light: #fef3c7
--color-info: #0ea5e9
--color-info-light: #f0f9ff
```

### Text Colors
```css
--color-text-darker: #111827
--color-text-dark: #1e293b
--color-text-heading: #1f2937
--color-text: #374151
--color-text-medium: #4b5563
--color-text-secondary: #6b7280
--color-text-muted: #9ca3af
--color-text-light: #d1d5db
--color-text-inverse: #ffffff
```

### Background Colors
```css
--color-bg-primary: #ffffff
--color-bg-secondary: #f8fafc
--color-bg-subtle: #f8fafc
--color-bg-muted: #f3f4f6
--color-bg-hover: #f1f5f9
```

### Border Colors
```css
--color-border: #e5e7eb
--color-border-medium: #d1d5db
--color-border-light: #f3f4f6
--color-border-focus: var(--color-primary)
```

### Surface / Glass
```css
--color-surface-glass: rgba(255, 255, 255, 0.85)
--color-surface-glass-dark: rgba(15, 23, 42, 0.85)
```

### Typography (Fluid / Clamp)
```css
--font-size-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.75rem)
--font-size-sm: clamp(0.8rem, 0.75rem + 0.25vw, 0.875rem)
--font-size-base: clamp(0.875rem, 0.825rem + 0.25vw, 1rem)
--font-size-md: clamp(0.925rem, 0.875rem + 0.25vw, 1.05rem)
--font-size-lg: clamp(1rem, 0.95rem + 0.25vw, 1.125rem)
--font-size-xl: clamp(1.125rem, 1rem + 0.5vw, 1.25rem)
--font-size-2xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)
--font-size-3xl: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem)
--font-size-4xl: clamp(1.75rem, 1.3rem + 2vw, 3.5rem)
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--line-height-tight: 1.2
--line-height-base: 1.4
--line-height-relaxed: 1.6
```

### Spacing (rem + px tokens)
```css
--space-xs: 0.25rem
--space-sm: 0.5rem
--space-md: 0.75rem
--space-lg: 1rem
--space-xl: 1.5rem
--space-2xl: 2rem
--space-3xl: 2.5rem
--space-4xl: 3rem
--space-px-10: 10px
--space-px-20: 20px
--space-px-24: 24px
--space-px-30: 30px
--space-px-40: 40px
--space-px-60: 60px
--space-px-80: 80px
```

### Border Radius
```css
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px
--radius-2xl: 20px
--radius-full: 9999px
```

### Shadows
```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08)
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.10)
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.10)
--shadow-xl: 0 8px 30px rgba(0, 0, 0, 0.12)
--shadow-elevated-xl: 0 32px 64px -12px rgba(0, 0, 0, 0.25)
--shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.06)
--shadow-inset: inset 0 2px 4px rgba(0, 0, 0, 0.10)
--shadow-focus: 0 0 0 3px var(--color-primary-ring)
--shadow-glow: 0 0 20px rgba(37, 99, 235, 0.25)
--shadow-glow-lg: 0 0 40px rgba(37, 99, 235, 0.30)
```

### Gradients
```css
--gradient-primary: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)
--gradient-hero: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)
--gradient-success: linear-gradient(135deg, var(--color-success) 0%, var(--color-success-dark) 100%)
--gradient-danger: linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger-dark) 100%)
--gradient-surface: linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)
--gradient-glass: linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)
```

### Transitions
```css
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1)
--transition-normal: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1)
--transition-bounce: 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)
--transition-spring: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)
--duration-fast: 150ms
--duration-normal: 300ms
--duration-slow: 500ms
--duration-slower: 750ms
```

### Blur / Misc
```css
--blur-sm: 4px
--blur-md: 8px
--blur-lg: 16px
--blur-xl: 24px
```

### ⚠️ Undefined Variables (Referenced but Never Defined)

| Variable | Referenced In | Impact |
|---|---|---|
| `--color-accent` | `AdminDashboard.css:92` | Falls back to `#8b5cf6` — silent purple bleed |
| `--color-text-primary` | `UserComponents.css:122`, `utilities.css:570` | Silently inherits or fails |

---

## Structural Problems Found

### 1. Inline Styles in JSX — 513 Total Occurrences

**Critical offender — TeamDetail.js: 107 inline styles, NO separate CSS file.**
This file (55KB) handles all styling via inline `style={{}}` objects. This is the single largest CSS debt item in the codebase.

| File | Inline style={{ Count |
|---|---|
| `TeamDetail.js` | **107** — no CSS file exists |
| `AgencyProfile.js` | 36 |
| `TeamsPage.js` | 33 |
| `AgencyDirectory.js` | 23 |
| `BrowseJobs.js` | 19 |
| `AdminMessagesTab.js` | 18 |
| `BrowseServices.js` | 14 |
| `PublicProfile.js` | 13 |
| `AdminWalletsTab.js` | 13 |
| `JobDetails.js` | 13 |
| `components.js` | 11 |
| `FreelancerDiscovery.js` | 10 |
| `ServiceDetails.js` | 10 |
| `AdminJobsTab.js` | 10 |
| *... 20+ more files* | |

**Total: 513 instances** across the codebase.

### 2. btn-primary Redefined in 4 Component Files (Conflicts with shared.css)

`shared.css` is the authoritative definition of `.btn-primary`. These files **redefine it locally**, creating specificity wars and unpredictable results:

```
Auth.css:308          .btn-primary { ... min-height: 48px; ... }  ← differs from shared.css 44px
Auth.css:471          .btn-primary { ... }  ← second redefinition inside same file
DisputeFilingForm.css:259  .btn-primary { ... }
Home.css:486          .btn-primary { background: var(--color-primary); color: white; ... }
ProposalWizard.css:264     .btn-primary { ... }
```

These should either extend via higher specificity or be deleted and rely on shared.css.

### 3. Duplicate Class Names Across Files (Same Name, Different Definitions)

Classes that appear in 3+ separate files with different styling:

| Class | Files | Risk |
|---|---|---|
| `.btn-primary` | 11 matches across 5 files | **High** — direct conflict with shared.css |
| `.stats-grid` | 6 matches (UserComponents.css, AdminDashboard.css) | Layout divergence |
| `.step-number` | 6 matches (DisputeFilingForm.css, ProposalWizard.css) | Duplication |
| `.footer-buttons` | 6 matches (same two files) | Extract to shared |
| `.skill-tag` | 6 matches (UserComponents, JobCard, JobDetails, Wizard, UniversalSearch) | 5 different definitions |
| `.form-group` | 6 matches across 5 files | Common form pattern, no canonical version |
| `.form-row` | 5 matches (Auth.css, TeamsPage.css) | |
| `.msg-row` | 5 matches (DisputeDetail.css, Messages.css) | |
| `.pagination` | 4 matches (UserComponents.css, AdminDashboard.css) | |
| `.activity-item` | 4 matches (AdminDashboard.css, Dashboard.css) | |
| `.search-input` | 4 matches (UserComponents, AdminDashboard, BrowseLayout) | |
| `.job-card` | 3 matches within JobCard.css itself | Self-conflict |

### 4. !important Usage (All 5 Instances)

Low count — acceptable. All instances are legitimate:

```
shared.css:38         transform: none !important;  ← disabled btn override (correct)
utilities.css:99      .hide-mobile { display: none !important; }
utilities.css:100     .hide-mobile (media query) { display: initial !important; }
utilities.css:101     .hide-desktop (media query) { display: none !important; }
utilities.css:103     .show-mobile (media query) { display: none !important; }
```

✅ All `!important` usage is in utility display-toggle helpers. No component-level `!important` found. This is clean.

### 5. Overly Specific Selectors

No 4-level deep selectors detected via automated search. Some 3-level selectors exist but appear intentional:

```css
/* ProjectManagement.css — acceptable scoping */
.pm-page-header h1 { ... }
.pm-page-header .pm-subtitle { ... }

/* UserComponents.css — acceptable */
.dashboard-profile-completion .completion-progress-wrapper { ... }
```

No pathological specificity wars found. This area is relatively clean.

### 6. Undefined CSS Variable References

```
AdminDashboard.css:92  .stat-card.payments-stat { border-left-color: var(--color-accent, #8b5cf6); }
```
`--color-accent` is **never defined in tokens.css**. The `#8b5cf6` fallback works but it's an undocumented magic purple that should either be added to tokens or replaced with `--color-info`.

```
UserComponents.css:122  color: var(--color-text-primary);
utilities.css:570       color: var(--color-text-primary);
```
`--color-text-primary` is **not defined**. The correct token is `--color-text`. These will silently inherit or render as initial value.

---

## Mobile-First Compliance

### Media Query Direction

| Type | Count | Percentage |
|---|---|---|
| `min-width` (mobile-first ✅) | **106** | **87%** |
| `max-width` (desktop-first ⚠️) | **16** | **13%** |

**Overall: Mobile-first. But 16 legacy max-width queries need remediation.**

### max-width Queries (All Instances)

```
AdminUserCard.css:650          @media (max-width: 640px)
AdminUserDrawer.css:254        @media (max-width: 480px)
AdminUserDrawer.css:329        @media (max-width: 480px)
SpendDashboard.css:67          @media (max-width: 480px)
AvailabilityManager.css:445    @media (max-width: 479px)
BookingDetail.css:32           @media (max-width: 480px)
BookingDetail.css:85           @media (max-width: 360px)
RecurringSeriesPanel.css:24    @media (max-width: 480px)
BoostCheckout.css:191          @media (max-width: 480px)
Contracts.css:146              @media (max-width: 480px)
Navigation.css:731             @media (min-width: 768px) and (max-width: 1023px)  ← range query, acceptable
EarningsDashboard.css:44       @media (max-width: 479px)
CreateService.css:829          @media (max-width: 480px)
ServiceDetails.css:215         @media (max-width: 480px)
DiscoverySettings.css:56       @media (max-width: 480px)
SkillAssessmentHub.css:498     @media (max-width: 600px)
```

Most are clustered around 480px — these are "mobile override" patches added after desktop styles were written, not true mobile-first design.

### Breakpoint System

**Consistent breakpoint reference defined in tokens.css:**
```
480px (sm) | 768px (md) | 1024px (lg) | 1280px (xl)
```
These are referenced in comments in tokens.css and used consistently in utilities.css. Component files also respect these values. However, **breakpoints are used as raw values in media queries** (not via CSS variables, since CSS var() doesn't work in media queries — this is correct and unavoidable).

Minor inconsistency: `AvailabilityManager.css` uses `479px` and `EarningsDashboard.css` uses `479px` instead of `480px`. These 1px discrepancies can cause off-by-one rendering gaps.

### Touch Targets (44px)

**Enforced at the system level** — global enforcement in `index.css`:
```css
button, [role="button"], a.btn, .btn {
  min-height: 44px;
}
```
And in `shared.css`:
```css
.btn { min-height: 44px; /* WCAG touch target */ }
```

Component-level manual enforcement also found:
```
UserComponents.css:251    min-height: 44px;
UserComponents.css:1152   min-height: 44px;
Messages.css              .mobile-back-btn { min-height: 44px; min-width: 44px; }
utilities.css:168,252     min-height: 44px;
```

⚠️ **Risk**: Inline style buttons in `TeamDetail.js` (107 instances) bypass these global rules entirely. Touch target compliance **cannot be guaranteed** for that component.

---

## Hardcoded Values Inventory

### Hardcoded Colors in Component CSS — 1,271 Total Instances

**Top offenders (instances that should be CSS variables):**

| File | Hardcoded Color Count |
|---|---|
| `AdminUserCard.css` | **108** |
| `Navigation.css` | 93 |
| `SkillAssessmentHub.css` | 83 |
| `TeamsPage.css` | 60 |
| `UserComponents.css` | 59 |
| `AdminDashboard.css` | 55 |
| `ProjectManagement.css` | 49 |
| `JobFeatureModal.css` | 43 |
| `JobDetails.css` | 42 |
| `Contracts.css` | 41 |

### Two Distinct Patterns of Misuse

**Pattern A — Var with redundant fallback (Navigation.css, AdminDashboard.css):**
The token system is working but CSS was written with unnecessary fallbacks that duplicate hardcoded values:
```css
/* Navigation.css */
color: var(--color-primary, #2563eb);       ← fallback is the token's own value
background: var(--color-border, #e5e7eb);   ← redundant
```
These fallbacks suggest the author didn't trust the token system. They're harmless but clutter the code.

**Pattern B — Raw hardcoded values (AdminUserCard.css, Profile.css):**
No var() at all — full bypass of the token system:
```css
/* AdminUserCard.css */
background: #fff;
border-bottom: 1px solid #e5e7eb;
color: #6b7280;
background: #f9fafb;
box-shadow: 0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1);

/* Profile.css */
background: #fffbeb;
border: 1px solid #a7f3d0;
background: #f0fdf4;
color: #166534;
background: #dcfce7;
```

These are semantic colors (success-green family `#f0fdf4, #a7f3d0, #dcfce7, #166534`) that map directly to existing tokens (`--color-success-light`, `--color-success`).

### Magic Numbers — 2,529 Raw px Values

Component CSS files contain 2,529 hardcoded pixel values. Most common offenders:
- `36px` (icon/avatar sizes — should be a token)
- `24px` (already in `--space-px-24` but not used)
- `18px`, `28px` (no token equivalent — should be added)
- Border-radius values like `10px`, `12px`, `14px`, `18px`, `20px` (should use `--radius-*`)

Specific examples:
```css
/* ProjectManagement.css:48 */
border-radius: 10px;   ← should be var(--radius-xl) = 12px or var(--radius-lg) = 8px

/* AdminUserCard.css:24 */
border-radius: 18px;   ← no token for 18px

/* Navigation.css */
height: 60px;          ← nav-height token says 64px — MISMATCH
```

⚠️ **Critical**: Navigation CSS sets `height: 60px` but `--nav-height: 64px` in tokens. The `.page-content` padding-top uses the token (64px) but the actual nav is 60px tall, creating a 4px layout gap.

---

## Component Pattern Analysis (5 Samples)

### 1. ProjectManagement.css (37KB — Largest file)

**Prefix:** `pm-` — consistent throughout  
**Structure:** Well-organized with comment section headers  
**Variable usage:** Mostly uses CSS vars for colors and spacing  
**Issues:**
- Hardcoded `border-radius: 10px` (should be `--radius-xl`)
- `color: var(--color-text-primary, #111)` — uses undefined `--color-text-primary`
- `min-height: 40px` on `.pm-btn-post` — violates 44px touch target rule
- `background: white` (should be `var(--color-bg-primary)`)
- Multiple hardcoded `1rem`, `1.5rem` spacing values instead of `--space-lg`, `--space-xl`

**Pattern quality:** 7/10 — Good intentions, minor token gaps

### 2. CreateService.css (28KB — 2nd largest)

**Prefix:** `wizard-` / `step-` / `cs-` — inconsistent, 3 different prefixes  
**Structure:** Emoji section headers, reasonably organized  
**Variable usage:** Good for colors, poor for spacing  
**Issues:**
- `.step` class name is generic — conflicts with other files (Wizard.css, ProposalWizard.css)
- `max-width: 480px` media query at line 829 — desktop-first override
- Hardcoded `0.9rem`, `0.85rem`, `1.25rem` font sizes instead of font tokens
- `background: white` used 3 times instead of `var(--color-bg-primary)`

**Pattern quality:** 6/10 — Good structure but naming inconsistency

### 3. Messages.css (24KB — 4th largest)

**Prefix:** `messages-` / `msg-` — two different prefixes in same file  
**Structure:** Emoji section headers, clearly mobile-first comments  
**Variable usage:** Excellent — best token usage of all audited files  
**Issues:**
- `msg-row` class name conflicts with `DisputeDetail.css` (same name, different styles)
- `border-radius: 8px` hardcoded instead of `--radius-lg`
- Some hardcoded spacing values (`0.375rem`, `0.625rem`) outside the token scale

**Pattern quality:** 8/10 — Cleanest of the large files

### 4. AdminUserCard.css (15KB — 12th largest, worst hardcoded colors)

**Prefix:** `auc-` — consistent  
**Structure:** Emoji section headers, comment-delimited sections  
**Variable usage:** **Poor** — 108 hardcoded color instances, mostly bypasses token system  
**Issues:**
- `background: #fff` — should be `var(--color-bg-primary)`
- `border-bottom: 1px solid #e5e7eb` — should be `var(--color-border)`
- `color: #6b7280` — should be `var(--color-text-secondary)`
- `background: #f9fafb` — should be `var(--color-bg-subtle)`
- `background: #eff6ff` — should be `var(--color-primary-light)`
- `box-shadow: 0 24px 80px rgba(0,0,0,0.22)` — custom shadow not in token system

This file was written **before the token system was established** and never migrated.

**Pattern quality:** 4/10 — Good structure, terrible token compliance

### 5. Navigation.css (16KB)

**Prefix:** `nav-` / `navigation` — consistent  
**Structure:** Section headers, mobile-first with clear desktop upgrades  
**Variable usage:** Mixed — uses vars but with redundant hardcoded fallbacks throughout  
**Issues:**
- `height: 60px` on `.navigation` but `--nav-height: 64px` — **4px mismatch**
- All colors have redundant fallbacks: `var(--color-primary, #2563eb)` throughout
- 1 range media query `(min-width: 768px) and (max-width: 1023px)` — acceptable for tablet styles
- `background: rgba(255, 255, 255, 0.97)` — not tokenized (no glassmorphism color token at that opacity)

**Pattern quality:** 6/10 — Good naming, nav-height mismatch is a real bug

---

## Quick Wins

### Immediate Deletions (Zero Risk)

1. **Remove redundant `.btn-primary` definitions** in Auth.css, DisputeFilingForm.css, Home.css, ProposalWizard.css — `shared.css` already defines this correctly. Delete the component-level overrides unless intentional deviations are needed (then use higher specificity, not redefinition).

2. **Remove var() fallbacks from Navigation.css and AdminDashboard.css** — All fallbacks match the actual token values. `var(--color-primary, #2563eb)` → `var(--color-primary)`. 93 + 55 lines of clutter.

3. **Delete duplicate `.stats-grid` in AdminDashboard.css** — UserComponents.css already defines it. If AdminDashboard needs a different layout, rename to `.admin-stats-grid`.

### Extract to CSS Variables (High Impact)

1. **`--color-accent: #8b5cf6`** — Add to tokens.css. Currently used in AdminDashboard with hardcoded fallback only.

2. **`--color-text-primary`** — Either add as alias for `--color-text`, or find-replace the 2 usages to `--color-text`.

3. **Nav height mismatch** — Fix `Navigation.css` to use `height: var(--nav-height)` = 64px. Current 60px is a layout bug.

4. **Common radius values** — `18px` and `14px` appear frequently but have no token. Add:
   ```css
   --radius-3xl: 14px;  /* or use --radius-xl: 12px */
   ```
   Or just standardize to existing tokens.

5. **Green semantic colors** in Profile.css — Replace:
   - `#f0fdf4` → `--color-success-light` (already `#ecfdf5`, close enough)
   - `#a7f3d0` → Add `--color-success-border: #a7f3d0` to tokens
   - `#166534` → Add `--color-success-darker: #166634` to tokens

### Standardize These Patterns

1. **File with no CSS: `TeamDetail.js`** — Extract 107 inline styles to `TeamDetail.css`. This is the highest-priority migration task.

2. **Mobile-first migration for 16 max-width queries** — Convert all `max-width: 480px` overrides to `min-width: 480px` base styles. Most are in Admin components.

3. **Scoped prefix naming** — Enforce the `[prefix]-` convention for the 18 non-compliant files. Simple rename pass.

4. **`background: white` / `color: white`** — Replace with `var(--color-bg-primary)` / `var(--color-text-inverse)`. Grep count: ~45 instances.

5. **Font sizes** — Replace `0.85rem`, `0.9rem`, `1.1rem` (raw rem) with `var(--font-size-sm)`, `var(--font-size-base)`, etc. ~200+ instances.

---

## Recommended CSS Standards for Fetchwork

### 1. Mandatory Token Usage

All component CSS must use tokens for colors, spacing, typography, and radius. No raw hex values, no raw rem/px for spacing (use `--space-*`). Exception: `rgba()` for opacity variants not in token system.

```css
/* ❌ BANNED */
color: #6b7280;
padding: 12px 16px;
border-radius: 8px;
font-size: 0.85rem;

/* ✅ REQUIRED */
color: var(--color-text-secondary);
padding: var(--space-md) var(--space-lg);
border-radius: var(--radius-lg);
font-size: var(--font-size-sm);
```

### 2. Scoped Class Prefix (Mandatory)

Every component CSS file must use a consistent 2–4 char prefix for all class names:
```
TeamDetail.css  →  .td-container, .td-header, .td-card
PricingPage.css →  .pp-hero, .pp-plan, .pp-cta
```

Document the prefix in the file header comment.

### 3. Mobile-First Media Queries Only

```css
/* ❌ BANNED — desktop-first override */
@media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }

/* ✅ REQUIRED — mobile-first */
.grid { grid-template-columns: 1fr; }  /* mobile base */
@media (min-width: 480px) { .grid { grid-template-columns: repeat(2, 1fr); } }
```

### 4. No Component-Level Redefinition of Shared Primitives

`.btn`, `.btn-primary`, `.btn-secondary`, `.card`, `.badge`, `.form-group` are owned by `shared.css`. Components extend via specificity, never redefine:

```css
/* ❌ BANNED — redefining shared primitive */
.btn-primary { background: blue; }

/* ✅ CORRECT — scoped extension */
.my-component .btn-primary { margin-top: var(--space-sm); }
```

### 5. No Inline Styles in JSX

All visual styling belongs in CSS files. `style={{}}` is permitted only for:
- Dynamic values computed at runtime (e.g., `style={{ width: progress + '%' }}`)
- Third-party library requirements

### 6. Var() Without Fallbacks

If the token system is working (it is), don't add redundant fallbacks:
```css
/* ❌ CLUTTER */
color: var(--color-primary, #2563eb);

/* ✅ CLEAN */
color: var(--color-primary);
```

### 7. File Header Standard

Each component CSS file should start with:
```css
/* ComponentName.css
 * Prefix: [xx]-
 * Scope: [FeatureName] component
 */
```

### 8. Touch Target Enforcement

All interactive elements must meet 44px minimum. Global rule in index.css covers most cases. Component-specific buttons/links need explicit `min-height: 44px` if they override defaults.

### 9. Undefined Variable Audit (Add to Token Review Checklist)

Before shipping any component:
- [ ] All `var(--xxx)` references exist in tokens.css
- [ ] No `--color-text-primary` (use `--color-text`)
- [ ] No `--color-accent` without token definition

---

## Priority Remediation Backlog

| Priority | Task | Effort | Impact |
|---|---|---|---|
| P0 | Fix `Navigation.css` height: 60px → `var(--nav-height)` | 5 min | Bug fix |
| P0 | Add `--color-accent` and `--color-text-primary` to tokens.css | 10 min | Stops silent failures |
| P1 | Extract `TeamDetail.js` 107 inline styles → `TeamDetail.css` | 2–3 hrs | Largest debt item |
| P1 | Delete `.btn-primary` overrides from 4 component files | 30 min | Fixes style conflicts |
| P2 | Migrate `AdminUserCard.css` 108 hardcoded colors → tokens | 1 hr | Token compliance |
| P2 | Convert 16 `max-width` queries to `min-width` | 2 hrs | Mobile-first purity |
| P3 | Remove redundant var() fallbacks (Navigation, AdminDashboard) | 1 hr | Cleanup |
| P3 | Replace `background: white` / `color: white` globally | 1 hr | Token compliance |
| P4 | Rename 18 non-prefixed CSS files to use scoped prefixes | 3 hrs | Convention enforcement |
| P4 | Migrate AgencyProfile.js (36 inline) and TeamsPage.js (33 inline) | 2 hrs | Debt reduction |

---

*SCOUT-CSS COMPLETE*
