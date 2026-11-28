/**
 * The packing screen's settings (27-packing-screen.md, section 9),
 * remembered on this device, not per run:
 *
 * - **Packing machine:** TrailMate (the default, Wyatt) or the Lucky Trail
 *   Outfitters cabinet. Both draw the same rules.
 *
 * The screen's sound button is Settings → Sound's Mute (32-audio-system.md,
 * section 3).
 *
 * Skip packing (testing) is with the other testing switches in
 * `debug/testingSettings.ts`.
 */
import { deviceSetting, useDeviceSetting } from '../app/deviceSetting';

export type PackingLook = 'trailmate' | 'cabinet';

export const PACKING_LOOKS: readonly { id: PackingLook; label: string; text: string }[] = [
  { id: 'trailmate', label: 'TrailMate', text: 'A GPS supply scanner.' },
  { id: 'cabinet', label: 'Cabinet', text: 'Lucky Trail Outfitters, a wooden slot machine.' },
];

export const PACKING_LOOK_SETTING = deviceSetting<PackingLook>(
  'hike-in-the-woods/packing-look',
  ['trailmate', 'cabinet'],
  'trailmate',
);

/** The packing machine picked on this device, re-rendering when it changes. */
export const usePackingLook = (): PackingLook => useDeviceSetting(PACKING_LOOK_SETTING);
