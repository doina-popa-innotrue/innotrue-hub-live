import { test, expect } from '../../fixtures/auth';

test.describe('Client Decisions', () => {
  test('client can view decisions list', async ({ clientPage }) => {
    await clientPage.goto('/decisions');

    // Should stay on decisions page
    await expect(clientPage).toHaveURL(/\/decisions/);

    // Page should load without errors — look for main content
    await expect(
      clientPage.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should not show an error boundary or crash
    await expect(clientPage.locator('text=Something went wrong')).not.toBeVisible();
  });
});
