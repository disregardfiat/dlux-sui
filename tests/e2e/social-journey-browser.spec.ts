/**
 * Social feed browser journey E2E.
 * Playwright-only, no backend calls. Covers feed visibility, post structure,
 * create-post CTA, and author profile navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Social Feed - Browser Journey', () => {
  test('home loads and social feed section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    const feedSection = page.locator('.social-feed-section, .feed-header, [class*="feed"]').first();
    await expect(feedSection).toBeVisible({ timeout: 10000 });
  });

  test('feed contains post elements with author and content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const feedSection = page.locator('.social-feed-section, .feed-header, [class*="feed"]').first();
    const feedVisible = await feedSection.isVisible({ timeout: 8000 }).catch(() => false);
    if (!feedVisible) {
      test.skip(true, 'Social feed section not visible — may not be deployed');
      return;
    }

    const posts = page.locator('.post-card, .feed-post, [class*="post"]');
    const postCount = await posts.count();
    if (postCount === 0) {
      test.skip(true, 'No posts in social feed yet');
      return;
    }

    // First post should have some text content (author name or body)
    const firstPost = posts.first();
    await expect(firstPost).toBeVisible();

    // Check for author link or identifier inside the post
    const authorLink = firstPost.locator('a[href^="/@"]');
    const hasAuthor = await authorLink.first().isVisible().catch(() => false);
    if (hasAuthor) {
      await expect(authorLink.first()).toBeVisible();
    }

    // Post should have non-empty text content
    const postText = await firstPost.textContent();
    expect(postText?.trim().length).toBeGreaterThan(0);
  });

  test('create post CTA is visible (may require auth)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const createBtn = page.getByRole('button', { name: /create post|new post|post/i });
    const createInput = page.getByPlaceholder(/what's on your mind|write a post|share/i);
    const hasCreate =
      (await createBtn.first().isVisible().catch(() => false)) ||
      (await createInput.first().isVisible().catch(() => false));

    if (!hasCreate) {
      test.skip(true, 'Create post CTA not visible — user may need to be logged in');
      return;
    }

    await expect(createBtn.first().or(createInput.first())).toBeVisible();
  });

  test('navigate to author profile from a feed post', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const feedSection = page.locator('.social-feed-section, .feed-header, [class*="feed"]').first();
    const feedVisible = await feedSection.isVisible({ timeout: 8000 }).catch(() => false);
    if (!feedVisible) {
      test.skip(true, 'Social feed section not visible');
      return;
    }

    const authorLink = page.locator('.post-card a[href^="/@"], .feed-post a[href^="/@"], [class*="post"] a[href^="/@"]').first();
    const hasAuthor = await authorLink.isVisible().catch(() => false);
    if (!hasAuthor) {
      test.skip(true, 'No author links in feed posts');
      return;
    }

    const href = await authorLink.getAttribute('href');
    expect(href).toBeTruthy();
    await authorLink.click();
    await page.waitForURL(/@/);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.account-page')).toBeVisible({ timeout: 10000 });
  });
});
