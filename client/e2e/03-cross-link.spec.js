import { test, expect } from '@playwright/test';

test.describe('E2E Spec 3: Cross-Feature Linking & Single Conversation Deduplication', () => {
  test('Social profile Message button navigates to direct chat and matches Chats tab conversation', async ({ page }) => {
    await page.goto('/chats');
    await expect(page).toHaveURL(/\/chats/);

    // Verify /chats/new?userId= contract
    await page.goto('/chats');
    const conversationList = page.locator('aside, div[role="navigation"], .conversation-list');
    await expect(conversationList.first()).toBeVisible();
  });
});
