import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

test.describe('Instructor Scenarios', () => {
  test('instructor sees Scenarios in sidebar under Teaching, clicks it, page loads without 404', async ({
    instructorPage,
  }) => {
    // Use desktop viewport so sidebar is expanded and Scenarios link is visible
    await instructorPage.setViewportSize({ width: 1280, height: 720 });
    await instructorPage.goto('/teaching');
    await dismissOverlays(instructorPage);

    await expect(instructorPage).toHaveURL(/\/teaching/);

    // Find Scenarios link by href and ensure it's in view (sidebar may be collapsed on small viewports)
    const scenariosLink = instructorPage.locator('a[href="/teaching/scenarios"]');
    await scenariosLink.scrollIntoViewIfNeeded();
    await expect(scenariosLink).toBeVisible({ timeout: 10_000 });
    await scenariosLink.click();

    await expect(instructorPage).toHaveURL(/\/teaching\/scenarios/, { timeout: 15_000 });
    await expect(instructorPage).not.toHaveURL(/404/);

    // Page loads: "Scenario Assignments" or any heading visible (no error boundary)
    await expect(
      instructorPage.getByRole('heading', { name: /scenario/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(instructorPage.locator('text=Something went wrong')).not.toBeVisible();
  });
});
