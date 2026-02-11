import { test, expect } from '../../fixtures/auth';

// TODO: Enable once coach credentials are configured on preprod
test.describe.skip('Coach Dashboard', () => {
  test('coach dashboard loads successfully', async ({ coachPage }) => {
    await coachPage.goto('/teaching');

    // Should stay on /teaching
    await expect(coachPage).toHaveURL(/\/teaching/);

    // Should show dashboard content
    await expect(
      coachPage.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should not show error boundary
    await expect(coachPage.locator('text=Something went wrong')).not.toBeVisible();
  });
});
