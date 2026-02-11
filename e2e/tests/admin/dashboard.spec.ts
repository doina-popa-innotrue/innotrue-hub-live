import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

test.describe('Admin Dashboard', () => {
  test('admin dashboard loads successfully', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    await dismissOverlays(adminPage);

    // Should be on /admin (or redirected to a sub-page)
    await expect(adminPage).toHaveURL(/\/admin/);

    // Should show dashboard content
    await expect(
      adminPage.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // TODO: Re-enable once ToS acceptance is reliably automated
  // (Radix UI checkbox doesn't respond to Playwright clicks consistently)
  // test('admin sidebar navigation is present', async ({ adminPage }) => {
  //   await adminPage.goto('/admin');
  //   await dismissOverlays(adminPage);
  //   await adminPage.waitForLoadState('networkidle');
  //   const linkCount = await adminPage.getByRole('link').count();
  //   expect(linkCount).toBeGreaterThan(3);
  // });

  test('non-admin user is redirected away from /admin', async ({ clientPage }) => {
    await clientPage.goto('/admin');

    // Client should be redirected to their own dashboard
    await expect(clientPage).not.toHaveURL(/\/admin/);
    await expect(clientPage).toHaveURL(/\/(dashboard|teaching|org-admin)/, {
      timeout: 10_000,
    });
  });
});
