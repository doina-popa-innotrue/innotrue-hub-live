import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

// Timeout for plans content after ToS/cookie dismissed (gate can delay first paint).
const PLANS_PAGE_LOAD_TIMEOUT_MS = 12_000;

test.describe('Admin Plans Management', () => {
  test('admin can open Plans Management, see plan list, edit plan and toggle is_purchasable then save', async ({
    adminPage,
  }) => {
    test.setTimeout(60_000);
    await adminPage.goto('/admin/plans');
    await dismissOverlays(adminPage);

    await expect(adminPage).toHaveURL(/\/admin\/plans/, { timeout: 10_000 });

    // Page content visible after cookie/ToS gate (dismissOverlays handles both)
    await expect(
      adminPage.getByRole('heading', { name: 'Plans Management' }).or(adminPage.getByText('No plans configured')),
    ).toBeVisible({ timeout: PLANS_PAGE_LOAD_TIMEOUT_MS });

    const firstEditBtn = adminPage.getByTitle('Edit Plan').first();
    const hasPlans = await firstEditBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasPlans) {
      await expect(adminPage.getByText('No plans configured')).toBeVisible();
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
