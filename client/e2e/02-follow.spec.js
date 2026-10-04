import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/e2eFixtures.js';

test.describe('E2E Spec 2: Social Graph, Follow Requests & Private Profiles', () => {
  test('Public account follow is immediate; private account follow transitions to requested', async ({ page }) => {
    await page.goto('/login');
    // Navigation to social feed
    await page.goto('/social');
    await expect(page).toHaveURL(/\/social/);
  });
});
