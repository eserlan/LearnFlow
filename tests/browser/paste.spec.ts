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
  await expect(page.locator('section.composer .note').first()).toContainText('Google Gemini');
  await page.locator('section.composer').getByRole('button', { name: 'Forenkle med AI' }).click();
  await expect(page.getByRole('heading', { name: 'Uferdige tekster' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Noe gikk galt hos oss');
  await expect(page.getByLabel('Aldersgruppe')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
});

test('edited draft survives reload and resume focuses the editor', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
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
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByLabel('Språk').selectOption('nn');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nn');
  await expect(page.getByRole('heading', { name: 'Gjer teksten lettare' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forenkl med KI' })).toBeVisible();
});

test('modern editor keeps the same flow and remembers the chosen theme', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
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
  await page.goto('/', { waitUntil: 'networkidle' });
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

async function seedLesson(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('learnflow'); request.onsuccess = () => resolve(request.result); request.onerror = reject;
    });
    const now = Date.now();
    const put = (store: string, value: unknown) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(); tx.onerror = reject;
    });
    await put('drafts', { id: 'd1', plainText: '**Video**\n\n### 1. Faser\n\n* **Forproduksjon:** planlegging', title: '**Video**', createdAt: now, lastActivityAt: now, status: 'processed', version: 1 });
    await put('lessons', { id: 'd1:1', draftId: 'd1', sourceVersion: 1, title: '**Video**', createdAt: now, sentences: [
      { text: 'Faser', kind: 'heading', sources: ['original'] },
      { text: 'Forproduksjon er **planlegging**.', kind: 'statement', sources: ['original'] },
      { text: '1. Hva er forproduksjon?', kind: 'task', sources: ['original'] },
      { text: '2. Hva er etterarbeid?', kind: 'task', sources: ['original'] }
    ] });
  });
  await page.reload();
}

test('lesson opens in a reading view with clean title, worksheet tasks and rendered source', async ({ page }) => {
  await seedLesson(page);
  await expect(page.getByRole('button', { name: /Vis leksjon: Video/ })).toBeVisible();
  await page.getByRole('button', { name: /Vis leksjon: Video/ }).click();
  const title = page.getByRole('heading', { name: 'Video', level: 2 });
  await expect(title).toBeFocused();
  await expect(page.locator('section.composer')).toHaveCount(0);
  await expect(page.locator('.reading > p strong')).toHaveText('planlegging');
  await expect(page.locator('ol.tasks li')).toHaveCount(2);
  await expect(page.locator('ol.tasks li').first()).toHaveText('Hva er forproduksjon?');
  await page.getByText('Vis originalteksten').click();
  await expect(page.locator('.source-text h3')).toHaveText('1. Faser');
  await expect(page.locator('.source-text li strong')).toHaveText('Forproduksjon:');
  await page.getByText('Lesevalg').first().click();
  await page.getByRole('button', { name: 'Større tekst' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Vis leksjon: Video/ }).click();
  await expect(page.locator('article.lesson')).toHaveCSS('font-size', '20.8px');
  await page.getByRole('button', { name: '← Tilbake' }).first().click();
  await expect(page.locator('section.composer')).toBeVisible();
});

test('deleting a lesson can be undone', async ({ page }) => {
  await seedLesson(page);
  await page.getByRole('button', { name: 'Slett' }).first().click();
  await expect(page.getByRole('status')).toContainText('Slettet: Video');
  await expect(page.getByRole('button', { name: /Vis leksjon/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Angre' }).click();
  await expect(page.getByRole('button', { name: /Vis leksjon: Video/ })).toBeVisible();
});

test('first visit explains the flow, and the guide goes away once there is a lesson', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('list', { name: 'Slik fungerer det' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('section.composer .note').first()).toContainText('lagres bare på denne enheten');
  await seedLesson(page);
  await expect(page.getByRole('list', { name: 'Slik fungerer det' })).toHaveCount(0);
});

test('lesson shows a one-time tip, and the AI caution links to the original', async ({ page }) => {
  await seedLesson(page);
  await page.getByRole('button', { name: /Vis leksjon: Video/ }).click();
  await expect(page.locator('.hint')).toContainText('Lag lyd');
  await page.getByRole('button', { name: 'Skjønner' }).click();
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Vis leksjon: Video/ }).click();
  await expect(page.locator('.hint')).toHaveCount(0);
  await expect(page.locator('details[open] .source-text')).toHaveCount(0);
  await page.getByRole('button', { name: 'originalteksten' }).click();
  await expect(page.locator('.source-text h3')).toBeVisible();
});

test('About page explains privacy and follows the chosen language', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByLabel('Språk').selectOption('nn');
  await page.getByRole('link', { name: 'Om LearnFlow' }).click();
  await expect(page).toHaveURL(/\/om\/?$/);
  await expect(page.getByRole('heading', { name: 'Kva skjer med teksten din?' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Google Gemini');
  await page.getByRole('link', { name: /Tilbake til LearnFlow/ }).click();
  await expect(page.getByRole('heading', { name: 'Gjer teksten lettare' })).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Språk')).toHaveValue('nn');
});
