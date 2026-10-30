import { expect, test } from '@playwright/test'

test('home renders the forum identity', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /grand forum/i })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Communities' })).toBeVisible()
})

test('search finds discussions from the server', async ({ page }) => {
  await page.goto('/search?q=review')
  await expect(page.getByRole('heading', { name: 'Advanced Search' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Threads/ })).toBeVisible()
})

test('guest cannot open admin', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByText('Admin access required')).toBeVisible()
})

test('login overlay authenticates a member', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in' }).first().click()
  await page.locator('#login-user').fill('alicewins')
  await page.locator('#login-pass').fill('password123')
  await page.locator('.btn-login').click()
  await expect(page.getByRole('link', { name: 'Post thread' }).first()).toBeVisible({ timeout: 15_000 })
})

test('thread page has a heading and reply form', async ({ page }) => {
  await page.goto('/')
  const first = page.locator('article a').first()
  await first.click()
  await expect(page.locator('h1.page-title')).toBeVisible({ timeout: 15_000 })
})

test('mobile navigation opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: /menu/i }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Communities' })).toBeVisible()
})
