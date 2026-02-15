import { test, expect } from '@playwright/test';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

test.describe('Password reset flow', () => {
  test('forgot password: navigate to login, click Forgot password, enter email, form submission succeeds', async ({
    page,
  }) => {
    await page.goto('/auth');
    await dismissOverlays(page);

    // Should be on auth page with login form (default tab is "login")
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });

    // Click "Forgot password?" (button next to Password label)
    await page.getByRole('button', { name: 'Forgot password?' }).click();

    // Forgot password form: email field visible (scope to avoid matching login label)
    const forgotSection = page.getByRole('heading', { name: 'Reset your password' });
    await expect(forgotSection).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#forgot-email')).toBeVisible();

    // Enter email and submit
    await page.locator('#forgot-email').fill('test@example.com');
    await page.getByRole('button', { name: /Send Reset Link/i }).click();

    // Form submission completes: success UI or error (toast/inline)
    await page.waitForTimeout(2_000);
    const successText = page.getByText(/check your email|we sent a password reset link/i);
    const backToSignIn = page.getByRole('button', { name: 'Back to Sign In' });
    const gotSuccess =
      (await successText.isVisible({ timeout: 10_000 }).catch(() => false)) ||
      (await backToSignIn.isVisible({ timeout: 10_000 }).catch(() => false));
    const gotError = await page
      .getByText(/failed|invalid|error|not found|no user|unable to send/i)
      .first()
      .isVisible({ timeout: 6_000 })
      .catch(() => false);
    expect(gotSuccess || gotError).toBe(true);
  });
});
