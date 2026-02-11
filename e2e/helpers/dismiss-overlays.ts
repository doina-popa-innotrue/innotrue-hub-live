import type { Page } from '@playwright/test';

/**
 * Dismiss common overlays that can block interaction:
 * - Cookie consent banner (fixed bottom overlay)
 * - Platform Terms of Service acceptance gate
 */
export async function dismissOverlays(page: Page) {
  // Wait for page to be reasonably loaded
  await page.waitForLoadState('domcontentloaded');

  // 1. Dismiss cookie banner by clicking "Necessary Only"
  const cookieBtn = page.getByRole('button', { name: /necessary only/i });
  if (await cookieBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
  }

  // 2. Accept Platform Terms of Service if shown (first-login gate)
  // The ToS gate blocks all navigation until accepted
  const agreeBtn = page.getByRole('button', { name: 'Agree & Continue' });
  if (await agreeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Radix UI Checkbox renders as <button role="checkbox">
    const tosCheckbox = page.getByRole('checkbox', { name: /terms/i });
    await tosCheckbox.waitFor({ state: 'visible', timeout: 5_000 });
    await tosCheckbox.click();

    // Wait for the button to become enabled (checkbox state propagates)
    await page.waitForTimeout(500);

    // Click "Agree & Continue"
    await agreeBtn.click();

    // Wait for dashboard to load after ToS acceptance
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }
}
