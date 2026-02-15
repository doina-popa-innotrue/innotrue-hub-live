import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

/**
 * Admin sidebar links that should resolve (no 404).
 * Only top-level routes without dynamic segments to keep the test fast and stable.
 */
const ADMIN_PATHS = [
  '/admin',
  '/admin/plans',
  '/admin/programs',
  '/admin/clients',
  '/admin/users',
  '/admin/assessments',
  '/admin/settings',
  '/admin/platform-terms',
  '/admin/interest-registrations',
  '/admin/groups',
  '/admin/notifications',
];

test.describe('Admin sidebar navigation', () => {
  test('admin can open each main sidebar route without 404', async ({ adminPage }) => {
    test.setTimeout(90_000);

    await adminPage.setViewportSize({ width: 1280, height: 720 });

    for (const path of ADMIN_PATHS) {
      await adminPage.goto(path);
      await dismissOverlays(adminPage);

      await expect(adminPage).toHaveURL(new RegExp(path.replace(/\//g, '\\/')), { timeout: 12_000 });
      await expect(adminPage).not.toHaveURL(/404/);

      // Page loaded: no generic error boundary
      await expect(adminPage.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 });
    }
  });
});
