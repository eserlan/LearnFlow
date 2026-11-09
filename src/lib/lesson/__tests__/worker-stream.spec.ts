import { describe, expect, it } from 'vitest';
import { createWorkerProcessor, readEventFrames, WorkerProcessorError } from '../worker-processor';

const request = { draftId: 'd', sourceVersion: 1, idempotencyKey: 'd:1', plainText: 'Tekst' };
const lesson = { kind: 'simplified-lesson', schemaVersion: 1, sentences: [{ text: 'Hei.', kind: 'statement', sources: ['original'] }] };

function streamOf(parts: string[]): Response {
	const encoder = new TextEncoder();
	return new Response(new ReadableStream({
		start(c) { for (const p of parts) c.enqueue(encoder.encode(p)); c.close(); }
	}), { headers: { 'Content-Type': 'text/event-stream' } });
}
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('readEventFrames', () => {
	it('reassembles frames split across chunks and ignores comments', async () => {
		const text = ': ping\n\n' + frame('sentence', { index: 0 }) + frame('done', { ok: true });
		const cut = Math.floor(text.length / 2);
		const frames = [];
		for await (const f of readEventFrames(streamOf([text.slice(0, cut), text.slice(cut)]).body!)) frames.push(f);
		expect(frames).toEqual([{ event: 'sentence', data: { index: 0 } }, { event: 'done', data: { ok: true } }]);
	});
});

describe('simplifyStream', () => {
	const processor = (response: Response, sent: RequestInit[] = []) =>
		createWorkerProcessor('https://api.example.test', async (_u, init) => { sent.push(init); return response; });

	it('reports progress in order and returns the final, complete result', async () => {
		const events: string[] = [];
		const sent: RequestInit[] = [];
		const result = await processor(streamOf([
			frame('accepted', { sourceVersion: 1 }),
			frame('sentence', { index: 0, sentence: { text: 'Hei.', kind: 'statement', sources: ['original'] } }),
			frame('reset', {}),
			frame('sentence', { index: 0, sentence: { text: 'Hei.', kind: 'statement', sources: ['original'] } }),
			frame('done', { sourceVersion: 1, verified: true, result: lesson })
		]), sent).simplifyStream!(request, {
			onAccepted: () => events.push('accepted'),
			onSentence: (s, i) => events.push(`sentence ${i} ${s.text}`),
			onReset: () => events.push('reset')
		});
		expect(events).toEqual(['accepted', 'sentence 0 Hei.', 'reset', 'sentence 0 Hei.']);
		expect(result).toEqual({ sourceVersion: 1, verified: true, result: lesson });
		expect((sent[0].headers as Record<string, string>).Accept).toBe('text/event-stream');
		expect(sent[0].credentials).toBe('omit');
	});

	it('throws the service error code from an error frame, without any text', async () => {
		await expect(processor(streamOf([frame('accepted', {}), frame('error', { error: 'invalid-output', reason: 'truncated' })]))
			.simplifyStream!(request, {})).rejects.toMatchObject({ code: 'http-error', backendCode: 'invalid-output' });
	});

	it('rejects a stream that ends without a final result, or for another source version', async () => {
		await expect(processor(streamOf([frame('accepted', {})])).simplifyStream!(request, {}))
			.rejects.toBeInstanceOf(WorkerProcessorError);
		await expect(processor(streamOf([frame('done', { sourceVersion: 2, verified: true, result: lesson })])).simplifyStream!(request, {}))
			.rejects.toMatchObject({ code: 'invalid-response' });
	});

	it('reads the error code from a JSON error before any stream starts', async () => {
		const res = Response.json({ error: 'rate_limited' }, { status: 429 });
		await expect(processor(res).simplifyStream!(request, {})).rejects.toMatchObject({ code: 'http-error', status: 429, backendCode: 'rate_limited' });
	});
});
