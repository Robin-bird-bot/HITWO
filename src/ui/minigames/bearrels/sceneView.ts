/**
 * What every Bearrels scene renderer takes (./Scene.tsx): the scene model,
 * which never depends on the style, and the ways the player touches it.
 */
import type { PointerEvent } from 'react';
import type { SceneModel } from '../../../minigames/bearrels/scene';
import type { Frame } from '../../../minigames/bearrels/styles';

export interface SceneViewProps {
  model: SceneModel;
  /** Pixel styles: where the 280 × 210 scene sits on the screen (whole-number scale). */
  frame?: Frame;
  /** A tap on a barrel (or a hiker behind it). */
  onBarrel?(index: number): void;
  /** The pointer over a barrel's tap area, or off it. */
  onHover?(index: number | null): void;
  /** A press on a hiker behind a barrel: maybe the start of a drag. */
  onHikerDown?(hikerId: string, e: PointerEvent): void;
}
