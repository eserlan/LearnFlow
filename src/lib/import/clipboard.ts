import type { ClipboardInput } from './types';

export function readClipboardEvent(event: ClipboardEvent): ClipboardInput {
  const data = event.clipboardData;
  if (!data) return { plainText: '' };
  return { plainText: data.getData('text/plain'), html: data.getData('text/html') || undefined };
}
