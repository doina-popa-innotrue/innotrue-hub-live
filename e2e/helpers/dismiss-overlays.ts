import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Dismiss common overlays that can block interaction:
 * 1. Cookie consent banner — click "Necessary Only"
 * 2. Platform Terms of Service gate — check the checkbox (keyboard), then click "Agree & Continue"
 *
 * Radix Checkbox does not reliably respond to click in headless Playwright; we use focus + Space.
 */
export async function dismissOverlays(page: Page) {
  await page.waitForLoadState('domcontentloaded');

  // 1) Dismiss cookie banner: click "Necessary Only"
  const cookieBtn = page.getByRole('button', { name: /necessary only/i });
  if (await cookieBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
  }

  // 2) ToS gate: check the checkbox (keyboard), then click "Agree & Continue"
  const agreeBtn = page.getByRole('button', { name: 'Agree & Continue' });
  if (await agreeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    // Check the ToS checkbox via keyboard (Radix checkbox doesn't reliably respond to click)
    const tosCheckbox = page.getByRole('checkbox', {
      name: /I have read and agree to the Terms & Conditions above/i,
    });
    await tosCheckbox.waitFor({ state: 'visible', timeout: 5_000 });
    await tosCheckbox.focus();
    await page.keyboard.press('Space');

    await expect(agreeBtn).toBeEnabled({ timeout: 10_000 });
    await agreeBtn.click();

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }
}
