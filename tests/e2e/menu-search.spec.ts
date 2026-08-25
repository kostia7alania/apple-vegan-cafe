import { expect, test } from '@playwright/test';

test('deep-linked search keeps the result navigation honest and the canonical URL clean', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/menu/?q=curry');

  const visibleItems = page.locator('[data-menu-item]:visible');
  const resultCount = await visibleItems.count();
  expect(resultCount).toBeGreaterThan(1);
  await expect(page.locator('[data-menu-search-status]')).toHaveText(`${resultCount} dishes found`);

  const visibleCategoryCounts = await page
    .locator('[data-menu-category-link]:visible [data-menu-category-count]')
    .allTextContents();
  expect(visibleCategoryCounts.length).toBeGreaterThan(1);
  expect(visibleCategoryCounts.map(Number).reduce((sum, count) => sum + count, 0)).toBe(
    resultCount,
  );

  await expect(page.locator('[data-menu-filter-context]')).toBeHidden();
  await expect(page.locator('[data-menu-quick-picks]')).toBeHidden();
  expect(
    await page
      .locator('[data-menu-hero]')
      .evaluate((hero) => getComputedStyle(hero).gridTemplateColumns.split(' ').length),
  ).toBe(1);
  await expect(page.locator('[data-menu-category-nav]')).toBeVisible();
  await expect(page.locator('[data-menu-search-jump]')).toBeHidden();
  await expect(page.locator('[data-menu-rail-order]')).toBeHidden();
  await expect(page.locator('[data-menu-filter-policy]:visible')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://apple-vegan-cafe.com/menu/',
  );

  await page.evaluate(() => scrollTo(0, 1600));
  await expect(page.locator('[data-menu-search-jump]')).toBeVisible();
  await expect(page.locator('[data-menu-rail-order]')).toBeVisible();
});

test('mobile zero state is actionable in the first viewport and clears in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/menu/?q=asdsasd');

  const noResults = page.locator('[data-menu-no-results]');
  await expect(page.locator('[data-menu-search-status]')).toHaveText('0 dishes found');
  await expect(page.locator('[data-menu-category-nav]')).toBeHidden();
  await expect(page.locator('[data-menu-filter-context]')).toBeHidden();
  await expect(noResults).toBeVisible();
  await expect(page.locator('[data-menu-item]:visible')).toHaveCount(0);

  const noResultsBox = await noResults.boundingBox();
  expect(noResultsBox).not.toBeNull();
  expect(noResultsBox!.y).toBeGreaterThanOrEqual(0);
  expect(noResultsBox!.y + noResultsBox!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.locator('[data-menu-no-results-clear]').click();
  await expect(page).toHaveURL('/menu/');
  await expect(page.locator('[data-menu-search-input]')).toBeFocused();
  await expect(page.locator('[data-menu-search-status]')).toBeEmpty();
  await expect(page.locator('[data-menu-category-nav]')).toBeVisible();
  await expect(page.locator('[data-menu-filter-context]')).toBeVisible();
  await expect(page.locator('[data-menu-quick-picks]')).toBeVisible();
  await expect(noResults).toBeHidden();

  const input = page.locator('[data-menu-search-input]');
  await input.fill('asdsasd');
  await input.press('Enter');
  await expect(noResults).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(input).toBeFocused();
  await expect(page).toHaveURL('/menu/');
});

test('short mobile zero state keeps its recovery action above the fixed action bar', async ({
  page,
}) => {
  for (const { path, actionBar, viewport } of [
    { path: '/menu/?q=asdsasd', actionBar: 'Quick actions', viewport: { width: 320, height: 700 } },
    { path: '/menu/?q=asdsasd', actionBar: 'Quick actions', viewport: { width: 320, height: 568 } },
    { path: '/th/menu/?q=asdsasd', actionBar: 'เมนูลัด', viewport: { width: 320, height: 568 } },
    {
      path: '/ru/menu/?q=asdsasd',
      actionBar: 'Быстрые действия',
      viewport: { width: 320, height: 568 },
    },
    { path: '/menu/?q=asdsasd', actionBar: 'Quick actions', viewport: { width: 360, height: 640 } },
    { path: '/th/menu/?q=asdsasd', actionBar: 'เมนูลัด', viewport: { width: 360, height: 640 } },
    {
      path: '/ru/menu/?q=asdsasd',
      actionBar: 'Быстрые действия',
      viewport: { width: 360, height: 640 },
    },
    { path: '/menu/?q=asdsasd', actionBar: 'Quick actions', viewport: { width: 360, height: 600 } },
    { path: '/th/menu/?q=asdsasd', actionBar: 'เมนูลัด', viewport: { width: 360, height: 600 } },
    {
      path: '/ru/menu/?q=asdsasd',
      actionBar: 'Быстрые действия',
      viewport: { width: 360, height: 600 },
    },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(path);

    const recoveryBox = await page.locator('[data-menu-no-results-clear]').boundingBox();
    const actionBarBox = await page.getByRole('navigation', { name: actionBar }).boundingBox();
    expect(recoveryBox, path).not.toBeNull();
    expect(actionBarBox, path).not.toBeNull();
    expect(recoveryBox!.y + recoveryBox!.height, path).toBeLessThanOrEqual(actionBarBox!.y);
  }
});

test('explicit search scrolls to the result and Escape only clears the text query', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/menu/?price=150');

  const input = page.locator('[data-menu-search-input]');
  await expect(page.locator('[data-menu-price-filter]')).toBeChecked();
  await input.fill('pad thai');
  await expect(page.locator('[data-menu-search-status]')).toHaveText('1 dish found');
  await input.press('Enter');
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        path: url.pathname,
        price: url.searchParams.get('price'),
        query: url.searchParams.get('q'),
      };
    })
    .toEqual({ path: '/menu/', price: '150', query: 'pad thai' });

  const firstVisibleItem = page.locator('[data-menu-item]:visible').first();
  const firstVisibleSection = page.locator('[data-menu-section]:visible').first();
  await expect(firstVisibleSection).toBeFocused();
  await expect(firstVisibleSection).toHaveAccessibleName(
    await firstVisibleSection.locator('h2').innerText(),
  );
  await expect(firstVisibleItem).toBeInViewport();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/menu/?price=150');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.locator('[data-menu-price-filter]')).toBeChecked();

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page).toHaveURL('/menu/');
  await expect(page.locator('[data-menu-price-filter]')).not.toBeChecked();
});

test('unavailable verified-diet deep links fail closed and reset explicitly', async ({ page }) => {
  for (const diet of ['jain', 'no-gluten']) {
    await page.goto(`/menu/?diet=${diet}`);

    await expect(page.locator('[data-menu-diet-filter]')).toHaveCount(0);
    await expect(page.locator('[data-menu-search-status]')).toHaveText('0 dishes found');
    await expect(page.locator('[data-menu-no-results-message]')).toHaveText(
      'No family-verified matches yet. Try removing a diet filter.',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://apple-vegan-cafe.com/menu/',
    );

    await page.locator('[data-menu-no-results-clear]').click();
    await expect(page).toHaveURL('/menu/');
    await expect(page.locator('[data-menu-item]:visible')).toHaveCount(
      await page.locator('[data-menu-item]').count(),
    );
  }
});

for (const { path, status } of [
  { path: '/menu/?q=pad+thai', status: '1 dish found' },
  { path: '/th/menu/?q=pad+thai', status: 'พบ 1 เมนู' },
  { path: '/ru/menu/?q=pad+thai', status: 'Найдено блюд: 1' },
]) {
  test(`search result count is localized on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('[data-menu-search-status]')).toHaveText(status);
  });
}

test('search input has a visible non-text contrast boundary', async ({ page }) => {
  await page.goto('/menu/');

  const contrastRatio = await page.locator('[data-menu-search-input]').evaluate((element) => {
    const toRgb = (value: string) =>
      value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
    const luminance = (channels: number[]) => {
      const [red, green, blue] = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
    };

    const styles = getComputedStyle(element);
    const border = luminance(toRgb(styles.borderTopColor));
    const background = luminance(toRgb(styles.backgroundColor));
    return (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
  });

  expect(contrastRatio).toBeGreaterThanOrEqual(3);
});
