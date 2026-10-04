/**
 * Flash Chat Playwright E2E Test Fixtures & Page Object Helpers
 */

export const DEV_TEST_OTP = '123456';

export async function signUpAndOnboard(page, { channel = 'phone', identifier = '+12345678900', username, name }) {
  await page.goto('/login');
  
  if (channel === 'email') {
    await page.getByRole('button', { name: /email/i }).click();
    await page.getByPlaceholder(/email/i).fill(identifier);
  } else {
    await page.getByPlaceholder(/phone/i).fill(identifier);
  }

  await page.getByRole('button', { name: /send code|continue/i }).click();

  // Enter OTP code
  const otpInput = page.locator('input[type="text"], input[type="number"]').first();
  await otpInput.fill(DEV_TEST_OTP);
  await page.getByRole('button', { name: /verify/i }).click();

  // Onboarding screen if new user
  if (await page.getByPlaceholder(/your name/i).isVisible({ timeout: 2000 }).catch(() => false)) {
    if (name) await page.getByPlaceholder(/your name/i).fill(name);
    if (username) await page.getByPlaceholder(/username/i).fill(username);
    await page.getByRole('button', { name: /complete setup|continue/i }).click();
  }
}

export async function openDirectChatWithUser(page, targetUsername) {
  await page.goto(`/u/${targetUsername}`);
  await page.getByRole('button', { name: /message/i }).click();
  await page.waitForURL(/\/chats\/[a-f0-9]+/i);
}
