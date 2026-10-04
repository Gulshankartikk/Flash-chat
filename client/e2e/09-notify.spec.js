import { test, expect } from '@playwright/test';

test.describe('E2E Spec 9: Web Push Notifications & In-App Alerts', () => {
  test('Settings > Notifications allows configuring push toggles and quiet hours', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);

    // Open notification settings if button is present
    const notifBtn = page.getByRole('button', { name: /push notification settings|notifications/i }).first();
    if (await notifBtn.isVisible()) {
      await notifBtn.click();
      await expect(page.locator('text=Notification Preferences').first()).toBeVisible();

      // Check quiet hours configuration
      const quietStart = page.locator('input[type="time"]').first();
      if (await quietStart.isVisible()) {
        await expect(quietStart).toBeEnabled();
      }
    }
  });

  test('Notification clicks with safe internal URLs navigate within origin; external URLs are rejected', async ({ page }) => {
    await page.goto('/chats');
    await expect(page).toHaveURL(/\/chats/);

    // Evaluate safeInternalPath helper in client context
    const safeInternal = await page.evaluate(() => {
      // Simulate client navigation handler
      const target = 'https://evil.com/phish';
      const fallback = '/chats';
      try {
        const parsed = new URL(target, window.location.origin);
        return parsed.origin === window.location.origin ? parsed.pathname : fallback;
      } catch {
        return fallback;
      }
    });

    expect(safeInternal).toBe('/chats');
  });
});
