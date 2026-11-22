# Update: November 21, 2026 (map corners: compass and section box printed on the map)

A small add-on to Phase 10.6, part A (the map edge). Build it with Phase 10.6, or right after it if 10.6 is already done.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `mockups/MapEdge.jpg` and `mockups/look/edge-table.jpg` → `docs/mockups/illustrated-map/` (replace the copies from 10.6).
- `topo_edge.py` → `docs/design/illustrated-map/reference/` (replace). It now draws both corner pieces.
- Then delete the leftover `update-2026-11-21-map-corners/` folder.

## The change
In the Illustrated map style, the compass rose and the section title box are **part of the map, not the screen**. They're little easter eggs you find when you pan or zoom out to the map's corners.

- **Section box, in the bottom-left corner of the land:**
  - a cream box with a double ink border;
  - the biome name in big letters (`MEADOW`);
  - under it, `SECTION I · TIER I`;
  - under that, the 3-block scale bar.
- **Compass rose, in the top-right corner of the land:**
  - 4 long and 4 short points, each half cream and half ink, with thin ink outlines;
  - a thin ring;
  - an `N` above it.
- **Position:** about [20] units in from the land's corner, inside the paper margin's border line. That's well outside the tree, so they never cover tiles or paths.
- **Drawing:**
  - Draw both in the overlay layer, in map coordinates, so they pan and zoom with the map and stay crisp.
  - Draw them on top of both the painted land and the pencil sketch, the same way whether or not that corner is revealed.
  - Size: section box about [170 × 74] units, compass about [80] units across, scaled with the map like everything else.
- **Remove the screen-fixed compass and title box** added in Phase 10.5. The **Legend** button stays on screen.
- The day and phase stay where they are in the HUD. The section box doesn't show the day.
- **Classic map style:** no change.

## Tests
- In Illustrated, no compass or title box is fixed to the screen.
- Both pieces sit in the land's corners and move with the camera.
- Neither one overlaps a tile, path or label.
