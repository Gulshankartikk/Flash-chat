import { test, expect } from '@playwright/test';

test.describe('E2E Spec 10: Offline Mode, Network Banner & Queued Delivery', () => {
  test('Going offline triggers the real-time offline status banner', async ({ context, page }) => {
    await page.goto('/chats');
    await expect(page).toHaveURL(/\/chats/);

    // Simulate going offline
    await context.setOffline(true);

    // Check for offline banner / network status
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('text=You are currently offline').first()).toBeVisible({ timeout: 5000 });

    // Restore online state
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  });
});
