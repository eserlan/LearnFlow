import { expect, test } from '@playwright/test';

test('pasting stores a draft and asks for consent before off-device processing', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Forenkle tekst' }).click();
  await expect(page.getByRole('status')).toContainText('lagret på denne enheten');
  await expect(page.getByRole('heading', { name: 'Før vi sender tekst til AI' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Uferdige tekster' })).toBeVisible();
  await page.getByLabel('Aldersgruppe').selectOption('under13');
  await expect(page.getByText('kreves verifisert foresattesamtykke', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', {name:'Send til AI og forenkle'})).toBeDisabled();
});

test('edited draft survives reload and resume focuses the editor', async ({ page }) => {
  await page.goto('/');
  const source=page.getByLabel('Lim inn teksten du vil lære');
  await source.fill('Første versjon av teksten.');
  await page.getByRole('button',{name:'Forenkle tekst'}).click();
  await page.getByRole('button',{name:'Avbryt'}).click();
  await page.getByRole('button',{name:'Rediger tekst'}).click();
  await expect(source).toBeFocused();
  await source.fill('Oppdatert versjon av teksten.');
  await page.getByRole('button',{name:'Forenkle tekst'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Rediger tekst'}).click();
  await expect(source).toHaveValue('Oppdatert versjon av teksten.');
});

test('Nynorsk labels main action and consent correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Språk').selectOption('nn');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nn');
  await expect(page.getByRole('heading', { name: 'Gjer teksten lettare' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forenkl tekst' })).toBeVisible();
});

test('modern editor keeps the same flow and remembers the chosen theme', async ({ page }) => {
  await page.goto('/');
  const shell = page.locator('main.learnflow-shell');
  await expect(shell).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { name: 'Gjør teksten enklere' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forenkle tekst' })).toBeVisible();
  await page.getByRole('button', { name: 'Bytt til mørk modus' }).click();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(shell).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Språk').selectOption('nn');
  await expect(page.getByRole('button', { name: 'Byt til lys modus' })).toBeVisible();
  await page.getByRole('button', { name: 'Byt til lys modus' }).click();
  await expect(shell).toHaveAttribute('data-theme', 'light');
});
