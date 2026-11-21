# Trail tree layout for the Phase 11 illustrated-map concept (1x board units, 1600 x 1000)
import math, random

W, H = 1600, 1000
rnd = random.Random(11)

ROW_Y = lambda r: 918 - r * 134
# key: (row, x, nodes, special)
BASE = {
 'A': (0, 800, [], 'TRAILHEAD'),
 'B': (1, 688, ['F', 'W'], None),
 'C': (1, 922, ['R', 'F'], None),
 'D': (2, 585, ['W'], 'TRAIL SIGN'),
 'E': (2, 800, ['F', 'F'], 'CHALLENGE'),
 'F': (2, 1020, ['R', 'R'], None),
 'G': (3, 590, ['M', 'F'], 'OVERLOOK'),
 'H': (3, 808, ['F', 'W', 'R'], 'OPPORTUNITY'),
 'I': (3, 1018, ['R'], 'CAMPSITE'),
 'J': (4, 600, ['M'], None),
 'K': (4, 800, ['W', 'F'], 'MYSTERY'),
 'L': (4, 1005, ['R', 'M'], None),
 'M': (5, 700, ['M', 'M'], None),
 'N': (5, 905, ['F'], 'NARROW PATH'),
 'P': (6, 800, [], 'CHECKPOINT'),
}
TILES = {}
for k, (r, x, nodes, sp) in BASE.items():
    jx = 0 if k in 'AP' else rnd.uniform(-24, 24)
    jy = 0 if k in 'AP' else rnd.uniform(-16, 16)
    sc = 1.0 if k in 'AP' else rnd.uniform(0.9, 1.07)
    TILES[k] = dict(k=k, row=r, x=x + jx, y=ROW_Y(r) + jy, nodes=nodes, special=sp, s=sc)

# edges: (a, b, type)  type: normal | steep | muddy | rough | paved
EDGES = [
 ('A', 'B', 'paved'), ('A', 'C', 'paved'),
 ('B', 'D', 'normal'), ('B', 'E', 'normal'), ('C', 'E', 'normal'), ('C', 'F', 'muddy'),
 ('D', 'E', 'normal'),
 ('D', 'G', 'rough'), ('E', 'H', 'normal'), ('F', 'I', 'normal'), ('F', 'H', 'muddy'),
 ('H', 'I', 'normal'),
 ('G', 'J', 'steep'), ('H', 'K', 'normal'), ('I', 'L', 'normal'), ('G', 'K', 'normal'),
 ('J', 'K', 'rough'),
 ('J', 'M', 'steep'), ('K', 'M', 'normal'), ('K', 'N', 'normal'), ('L', 'N', 'steep'),
 ('M', 'P', 'normal'), ('N', 'P', 'normal'),
]

# Who crossed what first (route history). colors = hiker spot colors.
HIKERS = {'finn': '#E2683C', 'ellie': '#4A8FD4', 'cody': '#EBC04A', 'gdog': '#A06CC9'}
CROSSED = {('A', 'B'): 'finn', ('A', 'C'): 'ellie', ('B', 'E'): 'finn', ('C', 'F'): 'ellie',
           ('B', 'D'): 'cody', ('D', 'G'): 'cody', ('F', 'I'): 'ellie', ('E', 'H'): 'finn',
           ('H', 'I'): 'gdog'}
# Revealed tiles (explored part of the map is painted, the rest is a pencil sketch)
REVEALED = set('ABCDEFGHIJK')
VISITED = set('ABCDEFGHI')
# where hikers stand now
STANDING = {'G': ['cody'], 'H': ['finn', 'gdog'], 'I': ['ellie']}


def wind(a, b, seed, bends=2, amp=22):
    """Winding trail points from tile a to tile b (1x units)."""
    r = random.Random(seed)
    ax, ay, bx, by = a['x'], a['y'], b['x'], b['y']
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    phase = r.uniform(0, math.pi)
    a1, a2 = r.uniform(.5, 1) * amp, r.uniform(.2, .6) * amp
    pts = []
    n = 40
    for i in range(n + 1):
        t = i / n
        off = (a1 * math.sin(math.pi * t * bends + phase) + a2 * math.sin(math.pi * t * (bends * 2 + 1))) * math.sin(math.pi * t)
        pts.append((ax + dx * t + nx * off, ay + dy * t + ny * off))
    return pts


PATHS = []
for i, (a, b, ty) in enumerate(EDGES):
    pts = wind(TILES[a], TILES[b], 100 + i, bends=1 + (i % 2), amp=16 if TILES[a]['row'] == TILES[b]['row'] else 24)
    who = CROSSED.get((a, b)) or CROSSED.get((b, a))
    PATHS.append(dict(a=a, b=b, type=ty, pts=pts, who=who))

# River: polyline through River-node tiles, flowing downhill (top to bottom)
RIVER = [(1480, -40), (1390, 40), (1300, 70), (1220, 140), (1140, 170), (1080, 215), (1050, 262), (990, 300), (1000, 345),
         (1062, 395), (1050, 450), (1010, 490), (1035, 540), (1015, 600), (1030, 660), (1000, 705), (950, 730), (935, 790),
         (870, 845), (790, 860), (720, 900), (640, 930), (560, 925), (470, 975), (400, 1010), (330, 1040)]
CREEK = [(-30, 330), (120, 300), (260, 320), (420, 360), (560, 420), (700, 410), (760, 395), (810, 400), (850, 440), (900, 470), (940, 500), (965, 540), (990, 560)]
LAKE = (1030, 655, 62, 44)  # cx, cy, rx, ry
