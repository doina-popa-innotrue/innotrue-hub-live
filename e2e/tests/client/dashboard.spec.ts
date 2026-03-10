import { test, expect } from '../../fixtures/auth';

test.describe('Client Dashboard', () => {
  test('client dashboard loads successfully', async ({ clientPage }) => {
    await clientPage.goto('/dashboard');

    // Should stay on /dashboard
    await expect(clientPage).toHaveURL(/\/dashboard/);

    // Wait for the dashboard data to finish loading — the page shows a
    // spinner (no heading) while queries are in flight against Supabase.
    // In CI, network latency to the live preprod instance can be >10 s.
    await expect(
      clientPage.getByRole('heading', { name: 'My Dashboard' }),
    ).toBeVisible({ timeout: 30_000 });
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
