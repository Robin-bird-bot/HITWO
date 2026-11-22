# Illustrated map: Python prototype

These scripts made the concept images in `docs/mockups/illustrated-map/`. They are a **reference**, not code to ship: port the ideas and numbers to TypeScript, and change whatever needs changing to run fast in a browser.

| File | What it does |
| --- | --- |
| `topo_layout.py` | The example trail tree: tile positions with jitter, node lists, edges with types, who walked what, which tiles are revealed. Also `wind()`, the winding path formula. |
| `topo.py` | The land generator: noise fields, height, hillshade cut into 4 tones, land types, rivers and the pond, contours, flowers and grass, tree crowns, paper grain, the pencil sketch, and the reveal mask. |
| `topo_extras.py` | The placeholder stamps (drawn with shapes) and the night, rain and snow grades. |
| `topo_edge.py` | The map edge (Phase 10.6): the paper margin with its printed double border, torn edge, fold lines and shadow, the wood table behind it, and the two corner pieces printed on the map (the section box bottom left, the compass rose top right). |
| `topo_tilt.py` | The tilted view. **Not part of Phase 10.5**; kept for a possible later intro shot. |
| `gen11.py` | The overlay on top of the land: path styles (dash, dotted, solid, walked colors), cost badges, bridges, the dark glass hex, pencil tiles, node chips, special icons, hiker tokens, labels, legend, compass and title box. Numbers here are in board pixels (1 unit = 1 px at a 1600 × 1000 view with 7 rows). |

Units: the prototype works in a 1600 × 1000 world where rows are 134 apart and the hex radius is 54. Scale everything by your own row spacing.

Python packages used: numpy, scipy, scikit-image (contours), opensimplex, pycairo, Pillow.
