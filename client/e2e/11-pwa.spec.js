import { test, expect } from '@playwright/test';

test.describe('E2E Spec 11: PWA Installation, Web Manifest & Cache Storage Denylist', () => {
  test('Web App Manifest is valid and resolves critical icon assets', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('Flash Chat');
    expect(manifest.short_name).toBe('Flash');
    expect(manifest.theme_color).toBe('#F97316');
    expect(manifest.background_color).toBe('#FFF7ED');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('Service worker Cache Storage strictly excludes sensitive API endpoints', async ({ page }) => {
    await page.goto('/chats');

    // Audit Cache Storage entries
    const cachedKeys = await page.evaluate(async () => {
      if (!('caches' in window)) return [];
      const cacheNames = await window.caches.keys();
      const urls = [];
      for (const name of cacheNames) {
        const cache = await window.caches.open(name);
        const requests = await cache.keys();
        urls.push(...requests.map(r => r.url));
      }
      return urls;
    });

    // Assert sensitive API denylist
    const FORBIDDEN_SUBSTRINGS = ['/api/auth', '/api/pocket', '/api/ai', '/api/push', '/api/upload'];
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      const hasLeak = cachedKeys.some(url => url.includes(forbidden));
      expect(hasLeak).toBe(false);
    }
  });
});
