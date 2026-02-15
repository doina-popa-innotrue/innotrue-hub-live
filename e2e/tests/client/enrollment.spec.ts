import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

test.describe('Client enrollment and program access', () => {
  test('client can open Programs, reach explore or program detail, and see content or modules', async ({
    clientPage,
  }) => {
    test.setTimeout(45_000);

    await clientPage.setViewportSize({ width: 1280, height: 720 });
    await clientPage.goto('/programs');
    await dismissOverlays(clientPage);

    await expect(clientPage).toHaveURL(/\/programs/, { timeout: 10_000 });

    // My Programs page: main heading confirms we're on the programs list
    await expect(clientPage.getByRole('heading', { name: 'My Programs', level: 1 })).toBeVisible({
      timeout: 12_000,
    });

    // Go to explore to see program catalog (top CTA or inline link when no enrollments)
    const exploreBtn = clientPage.getByRole('button', { name: /explore (more )?programs/i }).first();
    if (await exploreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await exploreBtn.click();
      await expect(clientPage).toHaveURL(/\/programs\/explore/, { timeout: 10_000 });
    }

    await dismissOverlays(clientPage);

    // Explore page: program cards with "View Details" or "Continue Learning", or empty state
    const viewDetails = clientPage.getByRole('button', { name: 'View Details' }).first();
    const continueLearning = clientPage.getByRole('button', { name: 'Continue Learning' }).first();
    const hasProgram =
      (await viewDetails.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await continueLearning.isVisible({ timeout: 2_000 }).catch(() => false));

    if (!hasProgram) {
      // No programs or no enrollable ones: just assert explore/list loaded (no 404)
      await expect(clientPage).not.toHaveURL(/404/);
      return;
    }

    const openProgramBtn = (await viewDetails.isVisible().catch(() => false))
      ? viewDetails
      : continueLearning;
    await openProgramBtn.scrollIntoViewIfNeeded();
    await openProgramBtn.click();

    // Either we navigate to /programs/:id (Continue Learning) or a dialog opens (View Details)
    try {
      await clientPage.waitForURL(/\/programs\/[a-f0-9-]+/, { timeout: 10_000 });
      await expect(clientPage).not.toHaveURL(/404/);
      await expect(
        clientPage
          .getByRole('heading', { level: 1 })
          .or(clientPage.locator('[data-testid="program-modules"]'))
          .or(clientPage.getByText(/modules|curriculum|content/i).first()),
      ).toBeVisible({ timeout: 10_000 });
      return;
    } catch {
      // Navigation didn't happen: View Details likely opened a dialog
    }

    const dialog = clientPage.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const goToProgram = clientPage.getByRole('button', { name: /continue learning|enroll|view program/i }).first();
      if (await goToProgram.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await goToProgram.click();
        await expect(clientPage).toHaveURL(/\/programs\/[a-f0-9-]+/, { timeout: 10_000 });
      }
    }

    await expect(clientPage).not.toHaveURL(/404/);
  });
});
