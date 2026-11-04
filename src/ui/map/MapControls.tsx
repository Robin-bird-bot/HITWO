import { Icon } from '../icons/Icon';
import { MAP_VIEW, ZOOM, zoomAt, type Bounds, type Camera } from './mapLayout';
import styles from './MapView.module.css';

interface MapControlsProps {
  camera: Camera;
  bounds: Bounds;
  onCamera(cam: Camera): void;
  onCenter(): void;
}

const CENTER = { x: MAP_VIEW.x + MAP_VIEW.w / 2, y: MAP_VIEW.y + MAP_VIEW.h / 2 };

/** Zoom in, zoom out, and centre on the selected hiker. */
export function MapControls({ camera, bounds, onCamera, onCenter }: MapControlsProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.control}
        aria-label="Zoom in"
        title="Zoom in"
        disabled={camera.zoom >= ZOOM.max}
        onClick={() => onCamera(zoomAt(camera, ZOOM.step, CENTER, bounds))}
      >
        <Icon name="plus" size={20} />
      </button>
      <button
        type="button"
        className={styles.control}
        aria-label="Zoom out"
        title="Zoom out"
        disabled={camera.zoom <= ZOOM.min}
        onClick={() => onCamera(zoomAt(camera, 1 / ZOOM.step, CENTER, bounds))}
      >
        <Icon name="minus" size={20} />
      </button>
      <button
        type="button"
        className={styles.control}
        aria-label="Centre on the selected hiker"
        title="Centre on the selected hiker"
        onClick={onCenter}
      >
        <Icon name="crosshair" size={20} />
      </button>
    </div>
  );
}
