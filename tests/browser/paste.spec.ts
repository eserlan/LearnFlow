import { expect, test } from '@playwright/test';

test('captures a user paste and stores the source as an unfinished draft', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	const source = page.getByLabel('Lim inn teksten du vil lære');
	await source.focus();
	await source.evaluate((textarea) => {
		const clipboard = new DataTransfer();
		clipboard.setData('text/plain', 'Dette er en testtekst som skal lagres lokalt.');
		clipboard.setData('text/html', '<p>Dette er en <strong>testtekst</strong> som skal lagres lokalt.</p>');
		textarea.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
	});
	await expect(source).toHaveValue('Dette er en testtekst som skal lagres lokalt.');
	await page.getByRole('button', { name: 'Lagre tekst' }).click();
	await expect(page.getByRole('status')).toContainText('lagret på denne enheten');
	await expect(page.getByRole('heading', { name: 'Uferdige tekster' })).toBeVisible();
	await expect(page.getByText('Dette er en testtekst som skal lagres lokalt.')).toBeVisible();
});

test('switches the paste and recovery flow to Nynorsk', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByLabel('Språk').selectOption('nn');
	await expect(page.locator('html')).toHaveAttribute('lang', 'nn');
	await expect(page.getByRole('heading', { name: 'Gjer teksten lettare' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Lagra tekst' })).toBeVisible();
});

test('resuming a draft visibly focuses the editor and keeps edits consistent with the saved source', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });
	const source = page.getByLabel('Lim inn teksten du vil lære');
	await source.fill('Første versjon av teksten.');
	await page.getByRole('button', { name: 'Lagre tekst' }).click();
	await expect(page.getByRole('heading', { name: 'Uferdige tekster' })).toBeVisible();

	await page.getByRole('button', { name: 'Fortsett' }).click();
	await expect(source).toBeFocused();
	await expect(source).toHaveValue('Første versjon av teksten.');
	await expect(page.getByRole('status')).toContainText('åpnet i tekstfeltet');

	await source.fill('Oppdatert versjon av teksten.');
	await page.getByRole('button', { name: 'Lagre tekst' }).click();
	await page.reload({ waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Fortsett' }).click();
	await expect(source).toHaveValue('Oppdatert versjon av teksten.');
});
