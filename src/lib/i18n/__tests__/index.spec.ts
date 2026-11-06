import { describe, expect, it } from 'vitest';
import { getCopy } from '..';

describe('interface copy', () => {
	it('provides the same message keys in Bokmål and Nynorsk', () => {
		expect(Object.keys(getCopy('nb')).sort()).toEqual(Object.keys(getCopy('nn')).sort());
	});

	it('keeps the primary action distinct across the two written standards', () => {
		expect(getCopy('nb').start).toBe('Lim inn og forenkle');
		expect(getCopy('nn').start).toBe('Lim inn og forenkl');
	});
});
