import { test as base, type Page } from '@playwright/test';
import { STORAGE_STATE } from '../helpers/auth-storage-paths';

/**
 * Extended test fixtures that provide pre-authenticated pages for each role.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *
 *   test('admin can view dashboard', async ({ adminPage }) => {
 *     await adminPage.goto('/admin');
 *     // ... already logged in as admin
 *   });
 */

type AuthFixtures = {
  adminPage: Page;
  clientPage: Page;
  coachPage: Page;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.admin,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  clientPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.client,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  coachPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.coach,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
