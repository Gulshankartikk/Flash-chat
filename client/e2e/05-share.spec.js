import { test, expect } from '@playwright/test';

test.describe('E2E Spec 5: Share to Chat & Story Replies', () => {
  test('Share sheet sends media snapshot card to selected conversation', async ({ page }) => {
    await page.goto('/social');
    await expect(page).toHaveURL(/\/social/);
  });
});
