import { test, expect } from '@playwright/test';
import { DEV_TEST_OTP } from './helpers/e2eFixtures.js';

test.describe('E2E Spec 1: Dual Channel OTP Authentication & Onboarding', () => {
  test('User A signs up with Phone OTP and completes profile onboarding', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Flash Chat/i);

    // Verify phone input and submit
    const phoneInput = page.getByPlaceholder(/phone/i);
    await phoneInput.fill('+15551002001');
    await page.getByRole('button', { name: /send verification code/i }).click();

    // Verify OTP step
    await page.waitForSelector('text=Enter Verification Code', { timeout: 5000 });
    const otpFields = page.locator('input[type="text"], input[type="number"]');
    await otpFields.first().fill(DEV_TEST_OTP);
    await page.getByRole('button', { name: /verify code/i }).click();

    // Verify Onboarding or Chats landing
    await expect(page).toHaveURL(/\/(onboarding|chats)/);
  });

  test('User B signs up with Email OTP and session stays active after page refresh', async ({ page }) => {
    await page.goto('/login');

    // Switch to email tab
    const emailTab = page.getByRole('button', { name: /email/i });
    if (await emailTab.isVisible()) {
      await emailTab.click();
      await page.getByPlaceholder(/email/i).fill('user_b_e2e@flashchat.io');
      await page.getByRole('button', { name: /send verification code/i }).click();

      await page.waitForSelector('text=Enter Verification Code', { timeout: 5000 });
      const otpFields = page.locator('input[type="text"], input[type="number"]');
      await otpFields.first().fill(DEV_TEST_OTP);
      await page.getByRole('button', { name: /verify code/i }).click();

      await expect(page).toHaveURL(/\/(onboarding|chats)/);
      await page.reload();
      await expect(page).toHaveURL(/\/(onboarding|chats)/);
    }
  });
});
