import { expect, test } from '@playwright/test';

test('pasting offers one-click AI simplification with no age selection or checkbox', async ({ page }) => {
  await page.route('**/capabilities', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ simplify: false })
  }));
  await page.goto('/', { waitUntil: 'networkidle' });
  const source = page.getByLabel('Lim inn teksten du vil lære');
  await source.focus();
  await source.evaluate((textarea) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', 'Dette er en testtekst som skal lagres lokalt.');
    clipboard.setData('text/html', '<p>Dette er en <strong>testtekst</strong> som skal lagres lokalt.</p>');
    textarea.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: clipboard, bubbles: true, cancelable: true
    }));
  });
  await expect(source).toHaveValue('Dette er en testtekst som skal lagres lokalt.');
  await expect(page.locator('section.composer .note')).toContainText('Google Gemini');
  await page.locator('section.composer').getByRole('button', { name: 'Forenkle med AI' }).click();
  await expect(page.getByRole('heading', { name: 'Uferdige tekster' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('AI-forenkling er ikke aktivert');
  await expect(page.getByLabel('Aldersgruppe')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
});

test('edited draft survives reload and resume focuses the editor', async ({ page }) => {
  await page.goto('/');
  const source=page.getByLabel('Lim inn teksten du vil lære');
  await source.fill('Første versjon av teksten.');
  await page.locator('section.composer').getByRole('button',{name:'Forenkle med AI'}).click();
  await page.getByRole('button',{name:'Rediger tekst'}).click();
  await expect(source).toBeFocused();
  await source.fill('Oppdatert versjon av teksten.');
  await page.locator('section.composer').getByRole('button',{name:'Forenkle med AI'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Rediger tekst'}).click();
  await expect(source).toHaveValue('Oppdatert versjon av teksten.');
});

test('Nynorsk labels main action correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Språk').selectOption('nn');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nn');
  await expect(page.getByRole('heading', { name: 'Gjer teksten lettare' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forenkl med KI' })).toBeVisible();
});

test('modern editor keeps the same flow and remembers the chosen theme', async ({ page }) => {
  await page.goto('/');
  const shell = page.locator('main.learnflow-shell');
  await expect(shell).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { name: 'Gjør teksten enklere' })).toBeVisible();
  await expect(page.locator('section.composer').getByRole('button', { name: 'Forenkle med AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Bytt til mørk modus' }).click();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Språk').selectOption('nn');
  await expect(page.getByRole('button', { name: 'Byt til lys modus' })).toBeVisible();
  await page.getByRole('button', { name: 'Byt til lys modus' }).click();
  await expect(shell).toHaveAttribute('data-theme', 'light');
});

test('mobile cards use the full viewport with readable inner padding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const composer = page.locator('section.composer');
  const textarea = page.getByLabel('Lim inn teksten du vil lære');
  const [cardBox, inputBox] = await Promise.all([composer.boundingBox(), textarea.boundingBox()]);
  expect(cardBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(cardBox!.x).toBe(0);
  expect(cardBox!.width).toBe(390);
  expect(inputBox!.x).toBeGreaterThanOrEqual(12);
  expect(inputBox!.x).toBeLessThanOrEqual(24);
  expect(inputBox!.width).toBeGreaterThan(340);
});
