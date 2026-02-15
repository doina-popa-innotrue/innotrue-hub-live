import { test, expect } from '@playwright/test';
import { dismissOverlays } from '../../helpers/dismiss-overlays';
import { TEST_USERS } from '../../helpers/test-users';

/**
 * Login (email/password) and redirect to the correct dashboard per role.
 * Google OAuth is not automated here; auth.setup uses email/password for stored sessions.
 */
test.describe('Login and dashboard redirect', () => {
  test('admin login redirects to /admin', async ({ page }) => {
    await page.goto('/auth');
    await dismissOverlays(page);

    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
    await page.locator('#login-email').fill(TEST_USERS.admin.email);
    await page.locator('#login-password').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('client login redirects to /dashboard', async ({ page }) => {
    await page.goto('/auth');
    await dismissOverlays(page);

    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
    await page.locator('#login-email').fill(TEST_USERS.client.email);
    await page.locator('#login-password').fill(TEST_USERS.client.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('instructor login redirects to /teaching', async ({ page }) => {
    await page.goto('/auth');
    await dismissOverlays(page);

    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
    await page.locator('#login-email').fill(TEST_USERS.instructor.email);
    await page.locator('#login-password').fill(TEST_USERS.instructor.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/teaching/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
