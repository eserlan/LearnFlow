/** Gemini 3.8 TTS via the Interactions API; all audio stays transient on the Worker. */
import { AiError, type AiEnv } from './simplify.ts';

export const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const MAX_TEXT_CHARS = 12_000;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const AUDIO_ID = /^[a-zA-Z0-9_-]{1,100}:[1-9][0-9]{0,8}$/;
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

export interface SpeakPayload {
  lessonId: string;
  text: string;
}

export function validateSpeakPayload(value: unknown): SpeakPayload | null {
  if (!record(value) || typeof value.lessonId !== 'string' ||
      !AUDIO_ID.test(value.lessonId) || typeof value.text !== 'string' ||
      value.text.trim().length < 3 || value.text.length > MAX_TEXT_CHARS ||
      new TextEncoder().encode(value.text).byteLength > 24_000 ||
      (value.text.match(/[\p{L}\p{N}]+/gu) ?? []).length > 2_000 ||
      Object.keys(value).some((key) => key !== 'lessonId' && key !== 'text')) return null;
  return { lessonId: value.lessonId, text: value.text };
}

function findInlineAudio(reply: unknown): string | null {
  if (!record(reply) || !Array.isArray(reply.steps)) return null;
  for (const step of reply.steps) {
    if (!record(step) || step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const part of step.content) {
      if (record(part) && part.type === 'audio' && part.mime_type === 'audio/wav' &&
          typeof part.data === 'string') return part.data;
    }
  }
  return null;
}

function decodeWav(data: string): Uint8Array<ArrayBuffer> {
  if (!data || data.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 8 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new AiError('invalid-output');
  let binary: string;
  try { binary = atob(data); }
  catch { throw new AiError('invalid-output'); }
  if (binary.length < 44 || binary.length > MAX_AUDIO_BYTES ||
      binary.slice(0, 4) !== 'RIFF' || binary.slice(8, 12) !== 'WAVE') {
    throw new AiError('invalid-output');
  }
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let offset = 0; offset < binary.length; offset += 8192) {
    for (let i = offset; i < Math.min(offset + 8192, binary.length); i++) bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function synthesizeLesson(
  input: SpeakPayload,
  env: AiEnv,
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch
): Promise<Uint8Array<ArrayBuffer>> {
  if (!env.GEMINI_API_KEY) throw new AiError('unavailable');
  // Keep the verbatim transcript separate from delivery instructions.
  const body = {
    model: TTS_MODEL,
    input: [{
      type: 'user_input',
      content: [{
        type: 'text',
        text: input.text,
        annotations: [{ type: 'speech_metadata',
          style: 'Read clearly at a calm, slightly slow pace, like a supportive school audiobook narrator. Keep every word of the transcript, without extra commentary.' }]
      }]
    }],
    response_format: { type: 'audio', mime_type: 'audio/wav' },
    generation_config: { speech_config: [{ voice: 'Kore' }] }
  };
  let response: Response;
  try {
    response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(100_000)
    });
  } catch { throw new AiError('unavailable'); }

  if (!response.ok) {
    if (response.status === 400) throw new AiError('provider_bad_request');
    if (response.status === 401 || response.status === 403) throw new AiError('provider_credentials');
    if (response.status === 404) throw new AiError('provider_model_not_found');
    if (response.status === 402 || response.status === 429) throw new AiError('provider_quota');
    throw new AiError('unavailable');
  }
  let output: unknown;
  try { output = await response.json(); }
  catch { throw new AiError('invalid-output'); }
  const audio = findInlineAudio(output);
  if (!audio) throw new AiError('invalid-output');
  return decodeWav(audio);
}
