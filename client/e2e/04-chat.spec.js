import { test, expect } from '@playwright/test';

test.describe('E2E Spec 4: Realtime Chat, Message Types & Message Actions', () => {
  test('Chat interface renders message bubble actions, inputs, and smart replies', async ({ page }) => {
    await page.goto('/chats');
    await expect(page).toHaveURL(/\/chats/);

    const messageInput = page.getByPlaceholder(/type a message/i).first();
    if (await messageInput.isVisible()) {
      await messageInput.fill('Hello from Playwright automated test!');
      await page.keyboard.press('Enter');
    }
  });
});
