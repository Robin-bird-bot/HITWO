/** Pointer positions on a puzzle game's 320 × 240 scene (PixelScreen). */
import { SCENE } from '../../minigames/screen';

/** A pointer position on the scene (scene units), from the scene element's box on the page. */
export function toScene(
  scene: HTMLElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const r = scene?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return { x: -1, y: -1 };
  return {
    x: ((clientX - r.left) / r.width) * SCENE.width,
    y: ((clientY - r.top) / r.height) * SCENE.height,
  };
}
