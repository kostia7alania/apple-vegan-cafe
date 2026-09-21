import { expect, test, type Page } from '@playwright/test';

interface CapturedEvent {
  eventName: string;
  hasEventCallback?: boolean;
  params: Record<string, unknown>;
}

async function captureAnalytics(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('apple_vegan_cafe_analytics_consent', 'granted');
    const testWindow = window as typeof window & {
      __analyticsEvents: CapturedEvent[];
      __appleVeganCafeAnalyticsReady: boolean;
      gtag: (command: unknown, eventName?: unknown, params?: unknown) => void;
    };
    testWindow.__analyticsEvents = [];
    testWindow.__appleVeganCafeAnalyticsReady = true;
    testWindow.gtag = (command, eventName, params) => {
      if (command !== 'event' || typeof eventName !== 'string') return;
      testWindow.__analyticsEvents.push({
        eventName,
        hasEventCallback:
          Boolean(params) &&
          typeof params === 'object' &&
          typeof (params as Record<string, unknown>).event_callback === 'function',
        params: params && typeof params === 'object' ? (params as Record<string, unknown>) : {},
      });
    };
  });
}

async function capturedEvents(page: Page, eventName?: string): Promise<CapturedEvent[]> {
  return page.evaluate((requestedEvent) => {
    const testWindow = window as typeof window & { __analyticsEvents?: CapturedEvent[] };
    const events = testWindow.__analyticsEvents ?? [];
    return requestedEvent ? events.filter((event) => event.eventName === requestedEvent) : events;
  }, eventName);
}

async function addSyntheticGoalLink(page: Page, destination: string) {
  await page.evaluate((href) => {
    const placement = document.createElement('div');
    placement.dataset.analyticsPlacement = 'navigation_delivery_test';

    const link = document.createElement('a');
    link.id = 'analytics-navigation-test-link';
    link.href = href;
    link.textContent = 'Order test';
    link.dataset.analyticsEvent = 'order_click';
    link.dataset.analyticsGoal = '';
    link.dataset.analyticsProvider = 'grabfood';

    placement.append(link);
    document.body.append(placement);
  }, destination);
}

test('analytics keeps campaign attribution but never sends menu search text', async ({ page }) => {
  await captureAnalytics(page);
  await page.goto(
    '/menu/?q=pad+thai&price=150&utm_id=avc_2026_q3_01&utm_source=instagram&utm_medium=organic_social&utm_campaign=august_menu',
  );

  await expect.poll(async () => (await capturedEvents(page, 'page_view')).length).toBe(1);
  await expect.poll(async () => (await capturedEvents(page, 'menu_filtered_view')).length).toBe(1);

  const [pageView] = await capturedEvents(page, 'page_view');
  const pageLocation = new URL(String(pageView!.params.page_location));
  expect(pageLocation.pathname).toBe('/menu/');
  expect(pageLocation.searchParams.get('utm_source')).toBe('instagram');
  expect(pageLocation.searchParams.get('utm_medium')).toBe('organic_social');
  expect(pageLocation.searchParams.get('utm_campaign')).toBe('august_menu');
  expect(pageLocation.searchParams.get('utm_id')).toBe('avc_2026_q3_01');
  expect(pageLocation.searchParams.has('q')).toBe(false);
  expect(pageLocation.searchParams.has('price')).toBe(false);

  const [filteredView] = await capturedEvents(page, 'menu_filtered_view');
  expect(filteredView!.params).toMatchObject({
    has_price_filter: true,
    has_query: true,
    query_length_bucket: '6_10',
    result_state: 'results',
  });
  expect(Number(filteredView!.params.result_count)).toBeGreaterThan(0);
  expect(JSON.stringify(await capturedEvents(page)).toLowerCase()).not.toContain('pad thai');
});

test('menu interactions report outcomes and filters without high-cardinality values', async ({
  page,
}) => {
  await captureAnalytics(page);
  await page.goto('/menu/');

  const input = page.locator('[data-menu-search-input]');
  await input.fill('private free text that matches nothing');
  await input.press('Enter');

  await expect.poll(async () => (await capturedEvents(page, 'menu_search')).length).toBe(1);
  await expect.poll(async () => (await capturedEvents(page, 'menu_zero_results')).length).toBe(1);
  const [search] = await capturedEvents(page, 'menu_search');
  expect(search!.params).toMatchObject({
    active_filter_count: 1,
    has_query: true,
    query_length_bucket: '11_plus',
    result_count: 0,
    result_state: 'zero',
  });

  await page.locator('[data-menu-no-results-clear]').click();
  await expect.poll(async () => (await capturedEvents(page, 'menu_filters_clear')).length).toBe(1);
  expect((await capturedEvents(page, 'menu_filters_clear'))[0]!.params.placement).toBe(
    'menu_zero_results',
  );

  await page.locator('[data-menu-price-filter]').check();
  await expect.poll(async () => (await capturedEvents(page, 'menu_filter_change')).length).toBe(1);
  expect((await capturedEvents(page, 'menu_filter_change'))[0]!.params).toMatchObject({
    filter_name: 'price_up_to_150',
    filter_state: 'on',
  });
  expect(JSON.stringify(await capturedEvents(page)).toLowerCase()).not.toContain(
    'private free text',
  );
});

test('goal clicks and impressions keep their provider and CTA placement', async ({ page }) => {
  await captureAnalytics(page);
  await page.goto('/');

  const order = page.locator(
    '[data-analytics-placement="home_hero"] [data-analytics-event="order_click"]',
  );
  await expect
    .poll(async () =>
      (await capturedEvents(page, 'cta_view')).some(
        (event) =>
          event.params.goal_name === 'order_click' &&
          event.params.placement === 'home_hero' &&
          event.params.provider === 'grabfood',
      ),
    )
    .toBe(true);

  await order.evaluate((element) =>
    element.addEventListener('click', (event) => event.preventDefault(), { once: true }),
  );
  await order.click();
  await expect.poll(async () => (await capturedEvents(page, 'order_click')).length).toBe(1);
  expect((await capturedEvents(page, 'order_click'))[0]!.params).toMatchObject({
    placement: 'home_hero',
    provider: 'grabfood',
    site_language: 'en',
  });
  expect((await capturedEvents(page, 'order_click'))[0]!.hasEventCallback).toBe(true);
  expect((await capturedEvents(page, 'order_click'))[0]!.params.event_timeout).toBe(800);

  const phone = page.locator(
    '[data-analytics-placement="home_action_grid"] [data-analytics-event="phone_click"]',
  );
  await phone.scrollIntoViewIfNeeded();
  await phone.evaluate((element) =>
    element.addEventListener('click', (event) => event.preventDefault(), { once: true }),
  );
  await phone.click();
  await expect.poll(async () => (await capturedEvents(page, 'phone_click')).length).toBe(1);
  expect((await capturedEvents(page, 'phone_click'))[0]!.params).toMatchObject({
    placement: 'home_action_grid',
    provider: 'phone',
  });
});

test('phone and email goals keep native navigation synchronous', async ({ page }) => {
  await captureAnalytics(page);
  await page.goto('/');

  const navigationWasNotCancelled = await page.evaluate(() =>
    [
      { eventName: 'phone_click', href: 'tel:+66826797797', provider: 'phone' },
      { eventName: 'contact_click', href: 'mailto:hello@example.com', provider: 'email' },
    ].map(({ eventName, href, provider }) => {
      const link = document.createElement('a');
      link.href = href;
      link.dataset.analyticsEvent = eventName;
      link.dataset.analyticsGoal = '';
      link.dataset.analyticsProvider = provider;
      document.body.append(link);

      return link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }),
      );
    }),
  );

  expect(navigationWasNotCancelled).toEqual([true, true]);
  await expect.poll(async () => (await capturedEvents(page, 'phone_click')).length).toBe(1);
  await expect.poll(async () => (await capturedEvents(page, 'contact_click')).length).toBe(1);
});

test('goal event callback continues same-tab navigation exactly once', async ({ page }) => {
  const destination = 'https://example.test/order-callback';
  let navigationRequests = 0;
  await page.route('https://example.test/**', async (route) => {
    navigationRequests += 1;
    await route.fulfill({ body: '<title>Order destination</title>', contentType: 'text/html' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('apple_vegan_cafe_analytics_consent', 'granted');
    const testWindow = window as typeof window & {
      gtag: (command: unknown, eventName?: unknown, params?: unknown) => void;
    };
    testWindow.gtag = (command, eventName, params) => {
      if (command !== 'event' || eventName !== 'order_click' || !params) return;
      const callback = (params as Record<string, unknown>).event_callback;
      if (typeof callback === 'function') callback();
    };
  });
  await page.goto('/');
  await addSyntheticGoalLink(page, destination);

  await page.locator('#analytics-navigation-test-link').click();

  await expect(page).toHaveURL(destination);
  expect(navigationRequests).toBe(1);
});

test('goal event timeout continues same-tab navigation exactly once', async ({ page }) => {
  const destination = 'https://example.test/order-timeout';
  let navigationRequests = 0;
  await page.route('https://example.test/**', async (route) => {
    navigationRequests += 1;
    await route.fulfill({ body: '<title>Order destination</title>', contentType: 'text/html' });
  });
  await captureAnalytics(page);
  await page.goto('/');
  await addSyntheticGoalLink(page, destination);

  await page.locator('#analytics-navigation-test-link').click();

  await expect(page).toHaveURL(destination, { timeout: 2_500 });
  expect(navigationRequests).toBe(1);
});

test('Google analytics queues by default and defers the tag until interaction', async ({
  page,
}) => {
  let googleTagRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleTagRequests += 1;
    await route.fulfill({ body: '/* analytics test loader */', contentType: 'text/javascript' });
  });
  await page.goto('/');

  const panel = page.locator('[data-analytics-consent]');
  test.skip((await panel.count()) === 0, 'GA4 is disabled for this build');
  await expect(panel).toBeVisible();
  expect(googleTagRequests).toBe(0);

  const commands = await page.evaluate(() =>
    (
      window as typeof window & {
        dataLayer?: IArguments[];
      }
    ).dataLayer?.map((entry) => Array.from(entry)),
  );
  const consentDefaults = commands?.filter(
    ([command, action]) => command === 'consent' && action === 'default',
  );
  expect(consentDefaults?.[0]?.[2]).toMatchObject({
    ad_storage: 'denied',
    analytics_storage: 'granted',
  });
  expect(consentDefaults?.[1]?.[2]).toMatchObject({
    analytics_storage: 'denied',
    region: expect.arrayContaining(['AT', 'CH', 'GB', 'NO']),
  });
  expect(
    commands?.some(([command, eventName]) => command === 'event' && eventName === 'page_view'),
  ).toBe(true);

  await page.locator('#main').dispatchEvent('pointerdown');
  await expect.poll(() => googleTagRequests).toBe(1);
  await page.locator('#main').dispatchEvent('keydown');
  expect(googleTagRequests).toBe(1);
});

test('keyboard interaction loads the deferred Google tag', async ({ page }) => {
  let googleTagRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleTagRequests += 1;
    await route.fulfill({ body: '/* analytics test loader */', contentType: 'text/javascript' });
  });
  await page.goto('/');

  const panel = page.locator('[data-analytics-consent]');
  test.skip((await panel.count()) === 0, 'GA4 is disabled for this build');
  expect(googleTagRequests).toBe(0);

  await page.locator('#main').dispatchEvent('keydown');
  await expect.poll(() => googleTagRequests).toBe(1);
});

test('explicit withdrawal disables an already-loaded Google property', async ({ page }) => {
  let googleTagRequests = 0;
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    googleTagRequests += 1;
    await route.fulfill({ body: '/* analytics test loader */', contentType: 'text/javascript' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('apple_vegan_cafe_analytics_consent', 'granted');
  });
  await page.goto('/');

  const panel = page.locator('[data-analytics-consent]');
  test.skip((await panel.count()) === 0, 'GA4 is disabled for this build');
  await page.locator('#main').dispatchEvent('pointerdown');
  await expect.poll(() => googleTagRequests).toBe(1);
  await page.evaluate(() => {
    document.cookie = '_ga=analytics-test; Path=/; SameSite=Lax';
  });

  await page.locator('[data-analytics-consent-open]').click();
  await panel.locator('[data-analytics-consent-choice="denied"]').click();

  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
  expect(
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __appleVeganCafeAnalyticsDisableProperty?: string;
        __appleVeganCafeAnalyticsReady?: boolean;
      };
      const property = testWindow.__appleVeganCafeAnalyticsDisableProperty;
      return {
        disabled: property
          ? Boolean((window as unknown as Record<string, unknown>)[property])
          : false,
        ready: testWindow.__appleVeganCafeAnalyticsReady,
      };
    }),
  ).toEqual({ disabled: true, ready: false });

  const queuedEventsAfterWithdrawal = await page.evaluate(
    () =>
      (
        window as typeof window & {
          dataLayer?: IArguments[];
        }
      ).dataLayer?.filter((entry) => entry[0] === 'event').length ?? 0,
  );
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.dataset.analyticsEvent = 'menu_click';
    document.body.append(button);
    button.click();
  });
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            dataLayer?: IArguments[];
          }
        ).dataLayer?.filter((entry) => entry[0] === 'event').length ?? 0,
    ),
  ).toBe(queuedEventsAfterWithdrawal);

  await page.reload();
  expect(googleTagRequests).toBe(1);
});

test('explicit opt-out persists and blocks future Google tag loads', async ({ page }) => {
  await page.clock.install();
  let googleRequests = 0;
  await page.route(
    /^https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,
    async (route) => {
      googleRequests += 1;
      await route.fulfill({ body: '/* analytics test loader */', contentType: 'text/javascript' });
    },
  );
  await page.route('https://region1.google-analytics.com/**', async (route) => {
    googleRequests += 1;
    await route.fulfill({ body: '/* analytics test loader */', contentType: 'text/javascript' });
  });
  await page.goto('/');

  const panel = page.locator('[data-analytics-consent]');
  test.skip((await panel.count()) === 0, 'GA4 is disabled for this build');
  expect(googleRequests).toBe(0);
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-analytics-consent-title]')).toBeFocused();
  await page.evaluate(() => {
    document.cookie = '_ga=analytics-test; Path=/; SameSite=Lax';
  });

  const consentOpener = page.locator('[data-analytics-consent-open]');
  await page.keyboard.press('Tab');
  await expect(panel.locator('[data-analytics-consent-choice="granted"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel.locator('[data-analytics-consent-choice="denied"]')).toBeFocused();
  await panel.locator('[data-analytics-consent-choice="denied"]').click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#main')).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem('apple_vegan_cafe_analytics_consent')),
  ).toBe('denied');
  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __appleVeganCafeAnalyticsReady?: boolean })
          .__appleVeganCafeAnalyticsReady,
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __appleVeganCafeAnalyticsDisableProperty?: string;
      };
      const property = testWindow.__appleVeganCafeAnalyticsDisableProperty;
      return property ? Boolean((window as unknown as Record<string, unknown>)[property]) : false;
    }),
  ).toBe(true);
  const queuedEventsAfterOptOut = await page.evaluate(
    () =>
      (
        window as typeof window & {
          dataLayer?: IArguments[];
        }
      ).dataLayer?.filter((entry) => entry[0] === 'event').length ?? 0,
  );
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.dataset.analyticsEvent = 'menu_click';
    document.body.append(button);
    button.click();
  });
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            dataLayer?: IArguments[];
          }
        ).dataLayer?.filter((entry) => entry[0] === 'event').length ?? 0,
    ),
  ).toBe(queuedEventsAfterOptOut);

  await page.clock.fastForward(10_100);
  expect(googleRequests).toBe(0);

  await page.reload();
  await expect(panel).toBeHidden();
  expect(googleRequests).toBe(0);

  await consentOpener.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-analytics-consent-title]')).toBeFocused();
  await panel.locator('[data-analytics-consent-choice="granted"]').click();
  await expect(consentOpener).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem('apple_vegan_cafe_analytics_consent')),
  ).toBe('granted');
  await expect.poll(() => googleRequests).toBe(1);
  expect(
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __appleVeganCafeAnalyticsDisableProperty?: string;
      };
      const property = testWindow.__appleVeganCafeAnalyticsDisableProperty;
      return property ? Boolean((window as unknown as Record<string, unknown>)[property]) : true;
    }),
  ).toBe(false);
});

test('every declared business goal has an event and stable placement', async ({ page }) => {
  for (const path of ['/', '/menu/', '/contact/', '/faq/']) {
    await page.goto(path);
    const missing = await page.locator('[data-analytics-goal]').evaluateAll((elements) =>
      elements
        .map((element) => ({
          event: element.getAttribute('data-analytics-event'),
          placement: element
            .closest('[data-analytics-placement]')
            ?.getAttribute('data-analytics-placement'),
        }))
        .filter(({ event, placement }) => !event || !placement),
    );
    expect(missing, path).toEqual([]);
  }
});
