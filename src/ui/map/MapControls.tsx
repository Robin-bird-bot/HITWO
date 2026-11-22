import { Icon } from '../icons/Icon';
import { MAP_VIEW, ZOOM, zoomAt, type Bounds, type Camera } from './mapLayout';
import styles from './MapView.module.css';

interface MapControlsProps {
  camera: Camera;
  bounds: Bounds;
  onCamera(cam: Camera): void;
  onCenter(): void;
  /** The route view (Phase 10.5): only walked paths stay bright. */
  routes?: boolean;
  onRoutes?(): void;
}

const CENTER = { x: MAP_VIEW.x + MAP_VIEW.w / 2, y: MAP_VIEW.y + MAP_VIEW.h / 2 };

/** The route view, zoom in, zoom out, and centre on the selected hiker. */
/** The route view's legend: each hiker's color. */
export function RouteLegend({ hikers }: { hikers: { id: string; name: string; color: string }[] }) {
  return (
    <div className={styles.routeLegend} role="note" aria-label="Route colors">
      <span className={styles.routeTitle}>ROUTES</span>
      {hikers.map((h) => (
        <span key={h.id} className={styles.routeHiker}>
          <span className={styles.routeDot} style={{ background: h.color }} />
          {h.name}
        </span>
      ))}
    </div>
  );
}

export function MapControls({
  camera,
  bounds,
  onCamera,
  onCenter,
  routes = false,
  onRoutes,
}: MapControlsProps) {
  return (
    <div className={styles.controls}>
      {onRoutes && (
        <button
          type="button"
          className={styles.control}
          aria-label="Routes: show who walked where"
          aria-pressed={routes}
          title="Routes: show who walked where (or hold Tab)"
          data-on={routes || undefined}
          onClick={onRoutes}
        >
          <Icon name="road" size={20} />
        </button>
      )}
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
