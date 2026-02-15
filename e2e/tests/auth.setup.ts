import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-users';
import { STORAGE_STATE } from '../helpers/auth-storage-paths';
import { acceptPlatformTermsViaApi } from '../helpers/accept-platform-terms-api';

/**
 * Auth setup — runs before all tests to create authenticated storageState files.
 *
 * Logs in via the UI (email/password) for each role. Platform Terms are pre-accepted
 * via the Supabase API (insert into user_platform_terms_acceptance) so the ToS gate
 * never shows; if the API isn't available (e.g. env vars missing), falls back to UI acceptance.
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

setup('authenticate as instructor', async ({ page }) => {
  await loginAndSaveState(page, TEST_USERS.instructor, STORAGE_STATE.instructor);
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

  const cookieBanner = page.getByRole('button', { name: /necessary only/i });
  if (await cookieBanner.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await cookieBanner.click();
    await page.waitForTimeout(500);
  }

  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
    timeout: 15_000,
  });

  // Pre-accept platform terms in the DB so the gate never shows (avoids fragile UI dismissal)
  const acceptedViaApi = await acceptPlatformTermsViaApi(page);
  if (acceptedViaApi) {
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  } else {
    await acceptTermsIfPresent(page);
  }

  await expect(page).not.toHaveURL(/error/);
  await page.context().storageState({ path: storagePath });
}

/**
 * Fallback: accept the ToS gate via the UI (checkbox + "Agree & Continue").
 * Used when pre-accept via API isn't available. Longer networkidle so DB write completes before saving state.
 */
async function acceptTermsIfPresent(page: import('@playwright/test').Page) {
  const agreeBtn = page.getByRole('button', { name: 'Agree & Continue' });
  if (!(await agreeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return;

  const checkbox = page.getByRole('checkbox', { name: /I have read and agree to the Terms/i });
  const checkboxVisible = await checkbox.isVisible({ timeout: 5_000 }).catch(() => false);
  if (checkboxVisible) {
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.focus();
    await page.keyboard.press('Space');
  }

  const enabled = await agreeBtn.isEnabled({ timeout: 10_000 }).catch(() => false);
  if (enabled) {
    await agreeBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
  }
}
