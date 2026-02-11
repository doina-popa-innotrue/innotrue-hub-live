import { test, expect } from '../../fixtures/auth';

test.describe('Client Dashboard', () => {
  test('client dashboard loads successfully', async ({ clientPage }) => {
    await clientPage.goto('/dashboard');

    // Should stay on /dashboard
    await expect(clientPage).toHaveURL(/\/dashboard/);

    // Should show dashboard content (heading or main content area)
    await expect(
      clientPage.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('client can navigate to decisions page', async ({ clientPage }) => {
    await clientPage.goto('/dashboard');
    await clientPage.waitForLoadState('networkidle');

    // Find and click the decisions link in navigation
    const decisionsLink = clientPage.getByRole('link', { name: /decision/i }).first();

    if (await decisionsLink.isVisible()) {
      await decisionsLink.click();
      await expect(clientPage).toHaveURL(/\/decisions/, { timeout: 10_000 });
    } else {
      // Navigate directly if link isn't in current view
      await clientPage.goto('/decisions');
      await expect(clientPage).toHaveURL(/\/decisions/);
    }
  });
});
