"""Builds the sound board page (board/index.html + board/sfx/*.mp3) from sounds.py and the manifest."""
import json, os, shutil, html
import sounds

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
B = os.path.join(HERE, 'board')
man = json.load(open(f'{OUT}/manifest.json'))['sounds']
os.makedirs(f'{B}/sfx', exist_ok=True)
rows = []
for e in sounds.S:
    m = man.get(e['id'])
    files = m['files'] if m else []
    for f in files:
        shutil.copy(f'{OUT}/mp3/{f}.mp3', f'{B}/sfx/{f}.mp3')
    rows.append(dict(id=e['id'], area=e['area'], when=e['when'], sound=e['sound'], status=e['status'],
                     loop=bool(e['loop']), files=files, note=e.get('note') or ''))
data = json.dumps(rows, ensure_ascii=False).replace('</', '<\\/')
tpl = open(os.path.join(HERE, 'board_template.html')).read()
open(f'{B}/index.html', 'w').write(tpl.replace('/*DATA*/[]', data))
print(len(rows), 'rows,', sum(len(r['files']) for r in rows), 'files')
