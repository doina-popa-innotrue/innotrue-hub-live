import { test, expect } from '../../fixtures/auth';

test.describe('Instructor Dashboard', () => {
  test('instructor dashboard loads successfully', async ({ instructorPage }) => {
    await instructorPage.goto('/teaching');

    // Should stay on /teaching
    await expect(instructorPage).toHaveURL(/\/teaching/);

    // Should show dashboard content
    await expect(
      instructorPage.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should not show error boundary
    await expect(instructorPage.locator('text=Something went wrong')).not.toBeVisible();
  });
});
