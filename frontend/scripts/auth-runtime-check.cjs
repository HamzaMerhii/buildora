const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultNavigationTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const base = process.env.BASE_URL || 'http://localhost:3000';
    if (process.argv.includes('--mock-reset-api')) {
      await page.route('**/auth/reset-password', async route => {
        assert.deepEqual(route.request().postDataJSON(), { token: 'test-token', new_password: 'new-password' });
        await new Promise(resolve => setTimeout(resolve, 700));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Password updated successfully' }) });
      });
      console.log('Reset API response mocked for frontend-only QA');
    }
    const visit = async route => {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await expect(page.locator('.auth-layout')).toBeVisible();
      await expect(page.locator('.sidebar, .topbar, .public-header, .public-footer')).toHaveCount(0);
    };
    if (!process.argv.includes('--remaining')) {
    await visit('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(base + '/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
    await expect(page.getByText('Email address is required', { exact: true })).toBeVisible();
    await page.getByLabel('Email Address').fill('invalid');
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
    await expect(page.getByText('Enter a valid email address', { exact: true })).toBeVisible();
    await page.getByLabel('Email Address').fill('demo@example.com');
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sending Reset Link...' })).toBeDisabled();
    await expect(page.getByText('If an account exists for this email address, a secure password reset link has been sent.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resend Reset Link' }).click();
    await expect(page.getByRole('button', { name: 'Sending Reset Link...' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Resend Reset Link' })).toBeEnabled();
    await page.getByRole('link', { name: 'Back to Sign In' }).click();
    await expect(page).toHaveURL(base + '/login');
    console.log('PASS login, forgot-password validation, loading, success, resend, and return link');
    }

    for (const route of ['/reset-password', '/reset-password?token=']) {
      await visit(route);
      await expect(page.getByRole('heading', { name: 'Reset link expired or invalid' })).toBeVisible();
      await expect(page.locator('input')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Request New Reset Link' })).toHaveAttribute('href', '/forgot-password');
      await expect(page.getByRole('link', { name: 'Back to Sign In' })).toHaveAttribute('href', '/login');
    }
    await page.getByRole('link', { name: 'Request New Reset Link' }).click();
    await expect(page).toHaveURL(base + '/forgot-password');
    await visit('/reset-password?token=test-token');
    await expect(page.getByText('test-token', { exact: true })).toHaveCount(0);
    const password = page.getByLabel('New Password', { exact: true });
    const confirm = page.getByLabel('Confirm New Password', { exact: true });
    const reset = page.getByRole('button', { name: 'Reset Password', exact: true });
    await reset.click();
    await expect(page.getByText('Password is required', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm your new password', { exact: true })).toBeVisible();
    await password.fill('short');
    await confirm.fill('short');
    await reset.click();
    await expect(page.getByText('Password must be at least 8 characters', { exact: true })).toBeVisible();
    await password.fill('new-password');
    await confirm.fill('different-password');
    await reset.click();
    await expect(page.getByText('Passwords do not match', { exact: true })).toBeVisible();
    await confirm.fill('new-password');
    await reset.click();
    await expect(page.getByRole('button', { name: 'Resetting Password...' })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'Password updated successfully' })).toBeVisible();
    await expect(page.locator('input')).toHaveCount(0);
    await page.getByRole('link', { name: 'Return to Sign In' }).click();
    await expect(page).toHaveURL(base + '/login');
    console.log('PASS reset invalid token, required/short/mismatched passwords, loading, success, and return link');

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/login', '/forgot-password', '/reset-password', '/reset-password?token=test-token']) {
        await visit(route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow: ' + route);
        if (width === 390) await expect(page.locator('.auth-visual')).toBeHidden();
        else await expect(page.locator('.auth-visual')).toBeVisible();
        await page.screenshot({ path: 'verification/auth-' + route.split('?')[0].slice(1) + (route.includes('?') ? '-form' : '') + '-' + width + '.png', fullPage: true });
      }
    }
    await visit('/sign-in');
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    assert.deepEqual(errors, [], 'Browser console/runtime errors');
    console.log('PASS desktop/mobile auth shells, screenshots, legacy sign-in, and no console/runtime errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
