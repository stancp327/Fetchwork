/**
 * Mobile viewport smoke tests.
 * Runs on Pixel 7 (412×915) per playwright.config.js project config.
 * Key assertion: no horizontal scroll (overflow-x) on any key page.
 */
const { test, expect } = require('@playwright/test');

// Pages that must be responsive and scroll-free
const PUBLIC_PAGES = ['/', '/jobs', '/login', '/register', '/freelancers'];

/**
 * Returns true if the page has horizontal scroll at the given viewport.
 * Checks document.documentElement.scrollWidth > window.innerWidth.
 */
async function hasHorizontalScroll(page) {
  return page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 2 // +2px tolerance
  );
}

test.describe('Mobile viewport — no horizontal overflow', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone SE

  for (const path of PUBLIC_PAGES) {
    test(`${path} has no horizontal scroll at 375px`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 15_000 });
      const overflows = await hasHorizontalScroll(page);
      expect(overflows).toBe(false);
    });
  }

  test('nav hamburger menu is visible at mobile width', async ({ page }) => {
    await page.goto('/');
    // Check burger icon or mobile nav toggle exists
    const burgerVisible = await page.locator(
      '.hamburger, [class*="mobile-menu"], [class*="burger"], button[aria-label*="menu" i]'
    ).isVisible().catch(() => false);
    // At minimum, the desktop nav should be hidden
    const desktopNavHidden = await page.locator('.nav-links, .desktop-nav')
      .evaluate(el => getComputedStyle(el).display === 'none')
      .catch(() => true);
    expect(burgerVisible || desktopNavHidden).toBe(true);
  });

  test('job browse cards stack vertically at 375px', async ({ page }) => {
    await page.goto('/jobs');
    // Cards should not overflow the viewport width
    const cardOverflow = await page.locator('.job-card, [class*="job-card"]').first()
      .evaluate(el => el.getBoundingClientRect().right > window.innerWidth + 2)
      .catch(() => false);
    expect(cardOverflow).toBe(false);
  });

  test('login form is usable at 375px (inputs not clipped)', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      const box = await emailInput.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(100);
      expect(box.x + box.width).toBeLessThanOrEqual(380); // fits in 375px viewport
    }
  });
});

test.describe('Mobile viewport — 360px (minimum supported)', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const path of ['/', '/jobs', '/login']) {
    test(`${path} no horizontal scroll at 360px`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 15_000 });
      const overflows = await hasHorizontalScroll(page);
      expect(overflows).toBe(false);
    });
  }
});
