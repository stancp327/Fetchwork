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

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Fix 1: Revert false ".css" → ".<prefix>css" in CSS comments + JS imports
tasks.forEach(({ css, js, prefix }) => {
  const cssPath = path.join(BASE, css);
  let cssText = fs.readFileSync(cssPath, 'utf8');
  const bad = `.${prefix}css`;
  if (cssText.includes(bad)) {
    cssText = cssText.split(bad).join('.css');
    fs.writeFileSync(cssPath, cssText);
    console.log(`  CSS fixed: ${css}`);
  }

  js.forEach(jsFile => {
    const jsPath = path.join(BASE, jsFile);
    let jsText = fs.readFileSync(jsPath, 'utf8');
    if (jsText.includes(bad)) {
      jsText = jsText.split(bad).join('.css');
      fs.writeFileSync(jsPath, jsText);
      console.log(`  JS  fixed: ${jsFile}`);
    }
  });
});

// Fix 2: Dynamic status-${status} in DisputeCenter.js needs dc- prefix
const dcJs = path.join(BASE, 'Disputes/DisputeCenter.js');
let dcText = fs.readFileSync(dcJs, 'utf8');
if (dcText.includes('status-${status}') && !dcText.includes('dc-status-${status}')) {
  dcText = dcText.replace(/status-\$\{status\}/g, 'dc-status-${status}');
  fs.writeFileSync(dcJs, dcText);
  console.log('  Fixed dynamic status-${status} → dc-status-${status}');
}

console.log('\nFix complete.');
