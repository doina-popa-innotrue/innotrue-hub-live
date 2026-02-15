import { test, expect } from '../../fixtures/auth';
import { dismissOverlays } from '../../helpers/dismiss-overlays';

test.describe('Client public profile', () => {
  test('client can open Public Profile settings and view profile at /p/slug', async ({
    clientPage,
  }) => {
    test.setTimeout(50_000);

    await clientPage.setViewportSize({ width: 1280, height: 720 });
    await clientPage.goto('/public-profile');
    await dismissOverlays(clientPage);

    await expect(clientPage).toHaveURL(/\/public-profile/, { timeout: 10_000 });
    await expect(clientPage.getByRole('heading', { name: 'Public Profile' })).toBeVisible({
      timeout: 10_000,
    });

    // If already published with a slug, we can open /p/{slug}; otherwise set slug and publish
    const slugInput = clientPage.getByLabel(/Custom URL Slug/i);
    const slugVisible = await slugInput.isVisible({ timeout: 5_000 }).catch(() => false);

    let publicSlug = 'e2e-public-profile';

    if (slugVisible) {
      await slugInput.fill(publicSlug);
      await clientPage.waitForTimeout(800); // allow slug check debounce
      const publishBtn = clientPage.getByRole('button', { name: /^Publish$/i });
      if (await publishBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await publishBtn.click();
        await clientPage.waitForTimeout(2_000);
      }
      // If "Republish" or already published, read slug from page (e.g. /p/xxx link)
      const pSlugLink = clientPage.locator('a[href^="/p/"]');
      if (await pSlugLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const href = await pSlugLink.getAttribute('href');
        const match = href?.match(/\/p\/([^/?#]+)/);
        if (match) publicSlug = match[1];
      }
    } else {
      // Page might show published URL; try to get slug from displayed link
      const pSlugLink = clientPage.locator('a[href^="/p/"]');
      if (await pSlugLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const href = await pSlugLink.getAttribute('href');
        const match = href?.match(/\/p\/([^/?#]+)/);
        if (match) publicSlug = match[1];
      }
    }

    // Navigate to /p/{slug} and verify the route resolves (not a 404 redirect)
    await clientPage.goto(`/p/${publicSlug}`);
    await dismissOverlays(clientPage);

    await expect(clientPage).toHaveURL(new RegExp(`/p/${publicSlug}`), { timeout: 8_000 });
    await expect(clientPage).not.toHaveURL(/404/);
  });
});
