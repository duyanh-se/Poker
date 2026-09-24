import { expect, test } from '@playwright/test';

test('renders the Vietnamese application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Poker cho.*nhóm riêng/ })).toBeVisible();
});

test('API health endpoint reports availability', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3101/health');

  await expect(response).toBeOK();
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});
