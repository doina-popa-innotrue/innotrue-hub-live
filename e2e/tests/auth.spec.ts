import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-users';

test.describe('Authentication', () => {
  test('login with valid email/password redirects to dashboard', async ({ page }) => {
    await page.goto('/auth');

    // Dismiss cookie banner if present
    const cookieBtn = page.getByRole('button', { name: /necessary only/i });
    if (await cookieBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cookieBtn.click();
    }

    await page.locator('#login-email').fill(TEST_USERS.client.email);
    await page.locator('#login-password').fill(TEST_USERS.client.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should navigate away from /auth
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 15_000,
    });

    // Should land on a dashboard page
    await expect(page).toHaveURL(/\/(dashboard|admin|teaching|org-admin)/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth');

    // Dismiss cookie banner if present
    const cookieBtn = page.getByRole('button', { name: /necessary only/i });
    if (await cookieBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await cookieBtn.click();
    }

    await page.locator('#login-email').fill('invalid@example.com');
    await page.locator('#login-password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Should stay on /auth and show an error message
    await expect(page).toHaveURL(/\/auth/);
    // Look for error toast or inline message
    await expect(
      page.getByText(/invalid|incorrect|error|not found/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated user is redirected to /auth', async ({ page }) => {
    // Try to access a protected route without being logged in
    await page.goto('/dashboard');

    // Should redirect to /auth
    await expect(page).toHaveURL(/\/auth/);
  });
});
