import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

// Timeout for plans content after ToS/cookie dismissed (gate can delay first paint).
const PLANS_PAGE_LOAD_TIMEOUT_MS = 15_000;

test.describe('Admin Plans Management', () => {
  test('admin can open Plans Management, see plan list, edit plan and toggle is_purchasable then save', async ({
    adminPage,
  }) => {
    test.setTimeout(60_000);
    await adminPage.goto('/admin/plans');
    await dismissOverlays(adminPage);

    await expect(adminPage).toHaveURL(/\/admin\/plans/, { timeout: 10_000 });

    // Wait for the page heading to appear
    await expect(
      adminPage.getByRole('heading', { name: 'Plans Management' }),
    ).toBeVisible({ timeout: PLANS_PAGE_LOAD_TIMEOUT_MS });

    // Wait for data to load: either plan cards appear (Edit Plan button) or the empty state shows.
    // The page shows a loading spinner while fetching, so we need to wait for the actual content.
    const firstEditBtn = adminPage.getByTitle('Edit Plan').first();
    const emptyState = adminPage.getByText('No plans configured');
    await expect(firstEditBtn.or(emptyState)).toBeVisible({ timeout: PLANS_PAGE_LOAD_TIMEOUT_MS });

    const hasPlans = await firstEditBtn.isVisible().catch(() => false);

    if (!hasPlans) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await firstEditBtn.click();

    // Dialog that contains the plan form (is_purchasable) — avoids matching other dialogs
    const dialog = adminPage.getByRole('dialog').filter({ has: adminPage.locator('#is_purchasable') });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const purchasableSwitch = dialog.locator('#is_purchasable');
    await purchasableSwitch.scrollIntoViewIfNeeded();
    await purchasableSwitch.click();

    const saveBtn = dialog.getByRole('button', { name: 'Save Changes' });
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 25_000 });
    await expect(adminPage.getByRole('heading', { name: 'Plans Management' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
