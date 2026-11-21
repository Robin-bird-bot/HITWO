/**
 * The land worker (Phase 10.5, section 8): builds and paints a section's land
 * off the main thread with OffscreenCanvas, and sends the two images back as
 * ImageBitmaps.
 */
import { generate } from './generate';
import type { LandInput } from './land/model';

interface Request {
  id: number;
  key: string;
  input: LandInput;
  scale: number;
  /** Debug: fail on purpose (the fallback test). */
  fail?: boolean;
}

const post = (message: unknown, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(
    message,
    transfer,
  );

self.addEventListener('message', (e: MessageEvent<Request>) => {
  const { id, key, input, scale, fail } = e.data;
  void (async () => {
    try {
      if (fail) throw new Error('Asked to fail (debug)');
      const g = await generate(key, input, scale);
      const painted = (g.painted as OffscreenCanvas).transferToImageBitmap();
      const sketch = (g.sketch as OffscreenCanvas).transferToImageBitmap();
      post({ id, ok: true, result: { ...g.result, painted, sketch } }, [
        painted,
        sketch,
        g.result.debug.type.buffer,
        g.result.debug.heightN.buffer,
      ]);
    } catch (err) {
      post({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
});
