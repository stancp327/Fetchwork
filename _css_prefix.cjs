const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'client/src/components');

const tasks = [
  { css: 'Billing/PricingPage.css', js: ['Billing/PricingPage.js'], prefix: 'pp-' },
  { css: 'Billing/UpgradePrompt.css', js: ['Billing/UpgradePrompt.js'], prefix: 'up-' },
  { css: 'Billing/WalletPage.css', js: ['Billing/WalletPage.js'], prefix: 'wp-' },
  { css: 'Bookings/AvailabilitySettings.css', js: ['Bookings/AvailabilitySettings.js'], prefix: 'as-' },
  { css: 'Boosts/BoostCheckout.css', js: ['Boosts/BoostCheckout.js'], prefix: 'bc-' },
  { css: 'Calls/IncomingCallOverlay.css', js: ['Calls/IncomingCallOverlay.js'], prefix: 'ico-' },
  { css: 'Calls/VideoCallModal.css', js: ['Calls/VideoCallModal.js'], prefix: 'vcm-' },
  { css: 'common/Footer.css', js: ['common/Footer.js'], prefix: 'ft-' },
  { css: 'common/LoadingSkeleton.css', js: ['common/LoadingSkeleton.js'], prefix: 'ls-' },
  { css: 'common/OnlineStatus.css', js: ['common/OnlineStatus.js'], prefix: 'os-' },
  { css: 'common/Toast.css', js: ['common/Toast.js'], prefix: 'toast-' },
  { css: 'Disputes/DisputeCenter.css', js: ['Disputes/DisputeCenter.js'], prefix: 'dc-' },
  { css: 'Disputes/DisputeTimeline.css', js: ['Disputes/DisputeTimeline.js'], prefix: 'dt-' },
  { css: 'Onboarding/OnboardingMilestone.css', js: ['Onboarding/OnboardingMilestone.js'], prefix: 'om-' },
  { css: 'Onboarding/ProfileWizard/Wizard.css', js: ['Onboarding/ProfileWizard/Wizard.js'], prefix: 'wiz-' },
  { css: 'Saved/SavedItems.css', js: ['Saved/SavedItems.js'], prefix: 'si-' },
  { css: 'Search/UniversalSearch.css', js: ['Search/UniversalSearch.js'], prefix: 'us-' },
  { css: 'Settings/EmailPreferences.css', js: ['Settings/EmailPreferences.js'], prefix: 'ep-' },
];

// Modifier classes used in compound selectors — skip prefixing these
const MODIFIERS = new Set([
  'active', 'on', 'enabled', 'completed', 'accept', 'reject', 'end',
  'overdue', 'online', 'offline', 'job', 'skill', 'category',
  'location', 'freelancer'
]);

function extractClasses(cssContent) {
  const re = /\.([a-zA-Z_][\w-]*)/g;
  const classes = new Set();
  let m;
  while ((m = re.exec(cssContent)) !== null) classes.add(m[1]);
  return [...classes];
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

tasks.forEach(({ css, js, prefix }) => {
  const cssPath = path.join(BASE, css);
  let cssText = fs.readFileSync(cssPath, 'utf8');

  const allClasses = extractClasses(cssText);
  const toRename = allClasses.filter(c => !c.startsWith(prefix) && !MODIFIERS.has(c));
  // Sort longest-first to avoid partial-match collisions
  toRename.sort((a, b) => b.length - a.length);

  console.log(`\n${css} (${prefix}): ${toRename.length} classes`);
  if (toRename.length === 0) { console.log('  (nothing to rename)'); return; }

  // --- CSS: replace .classname with .prefix-classname ---
  toRename.forEach(cls => {
    const re = new RegExp(`\\.${esc(cls)}(?=[^\\w-]|$)`, 'gm');
    cssText = cssText.replace(re, `.${prefix}${cls}`);
  });
  fs.writeFileSync(cssPath, cssText);
  console.log('  CSS written');

  // --- JS: replace classname with prefix-classname (word-boundary aware) ---
  js.forEach(jsFile => {
    const jsPath = path.join(BASE, jsFile);
    let jsText = fs.readFileSync(jsPath, 'utf8');
    toRename.forEach(cls => {
      const re = new RegExp(`(?<![\\w-])${esc(cls)}(?![\\w-])`, 'g');
      jsText = jsText.replace(re, `${prefix}${cls}`);
    });
    fs.writeFileSync(jsPath, jsText);
    console.log(`  JS  ${jsFile} written`);
  });
});

console.log('\nDone — all 18 CSS + JS pairs processed.');
