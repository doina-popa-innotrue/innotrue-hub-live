import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-users';
import { STORAGE_STATE } from '../helpers/auth-storage-paths';

/**
 * Auth setup — runs before all tests to create authenticated storageState files.
 *
 * Logs in via the UI (email/password) for each role, accepts Terms of Service
 * if needed, and saves the browser state so actual tests start authenticated.
 */

setup('authenticate as admin', async ({ page }) => {
  await loginAndSaveState(page, TEST_USERS.admin, STORAGE_STATE.admin);
});

setup('authenticate as client', async ({ page }) => {
  await loginAndSaveState(page, TEST_USERS.client, STORAGE_STATE.client);
});

setup('authenticate as coach', async ({ page }) => {
  await loginAndSaveState(page, TEST_USERS.coach, STORAGE_STATE.coach);
});

/**
 * Login via the Auth page UI and save browser state for reuse in tests.
 */
async function loginAndSaveState(
  page: import('@playwright/test').Page,
  user: { email: string; password: string; dashboardPath: string },
  storagePath: string,
) {
  await page.goto('/auth');

  // Dismiss cookie banner if present (privacy-preserving: click "Necessary Only")
  const cookieBanner = page.getByRole('button', { name: /necessary only/i });
  if (await cookieBanner.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cookieBanner.click();
    await page.waitForTimeout(500);
  }

  // Fill in the login form using input IDs (no placeholder text on these inputs)
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.password);

  // Click the sign-in button
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  // Wait for navigation away from /auth — indicates successful login
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
    timeout: 15_000,
  });

  // Accept Platform Terms of Service if shown (first-login gate)
  // The ToS page shows on first login: checkbox + "Agree & Continue" button
  await acceptTermsIfPresent(page);

  // Verify we landed on a valid page (not an error)
  await expect(page).not.toHaveURL(/error/);

  // Save the authenticated state (including ToS acceptance)
  await page.context().storageState({ path: storagePath });
}

/**
 * Accept the Platform Terms of Service gate if it appears after login.
 */
async function acceptTermsIfPresent(page: import('@playwright/test').Page) {
  // Check if the ToS gate is present by looking for its checkbox in the DOM
  const tosCheckbox = page.locator('#agree-platform-terms');
  const count = await tosCheckbox.count();
  if (count === 0) return;

  // Click the Radix UI checkbox directly (renders as <button role="checkbox">)
  const checkbox = page.getByRole('checkbox', { name: /terms/i });
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click();
  await page.waitForTimeout(300);

  // Click the "Agree & Continue" button
  const agreeBtn = page.getByRole('button', { name: 'Agree & Continue' });
  await agreeBtn.scrollIntoViewIfNeeded();
  await agreeBtn.click();

  // Wait for dashboard to load
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
