"""Renders every made sound in sounds.py to WAV, OGG and MP3, and writes manifest.json.
Usage: python3 render.py [id-prefix ...]"""
import json, os, subprocess, sys, zlib
import numpy as np
from scipy.io import wavfile
import synth
from synth import N, SR, stereo, trim, fade, loopify, fit
import sounds

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
for d in ('wav', 'ogg', 'mp3'):
    os.makedirs(f'{OUT}/{d}', exist_ok=True)

TARGET = {'soft': -27.0, 'normal': -21.0, 'loud': -17.0, 'bed': -27.0}  # dBFS, loudest 50 ms (beds: overall)


def db(x):
    return 20 * np.log10(max(x, 1e-12))


def level(x, kind):
    m = x.mean(axis=1)
    if kind == 'bed':
        return db(np.sqrt(np.mean(m ** 2)))
    w = N(0.05)
    if len(m) <= w:
        return db(np.sqrt(np.mean(m ** 2)))
    c = np.cumsum(np.r_[0, m ** 2])
    r = np.sqrt((c[w:] - c[:-w]) / w)
    return db(r.max())


def fname(e, v):
    base = e['id'].replace('.', '-')
    return f"{base}-{v + 1}" if e['variants'] > 1 else base


def render(e, v):
    synth.seed(zlib.crc32(f"{e['id']}#{v}".encode()))
    x = e['fn'](v)
    x = np.nan_to_num(np.asarray(x, float))
    x = stereo(x)
    if e['loop']:
        x = loopify(fit(x, e['loop'] + 1.0), 1.0)
    else:
        x = fade(trim(x), 0.001, 0.008)
    x -= x.mean(axis=0)
    g = 10 ** ((TARGET[e['level']] - level(x, e['level'])) / 20)
    x = x * g
    pk = np.abs(x).max()
    if pk > 0.89:  # -1 dBFS
        x *= 0.89 / pk
    return x


def main(prefixes):
    manifest = {}
    report = []
    for e in sounds.S:
        if not e['fn'] or e['status'] not in ('made', 'placeholder'):
            continue
        if prefixes and not any(e['id'].startswith(p) for p in prefixes):
            continue
        files = []
        for v in range(e['variants']):
            x = render(e, v)
            f = fname(e, v)
            wavfile.write(f'{OUT}/wav/{f}.wav', SR, (x * 32767).astype(np.int16))
            q = ['-q:a', '3'] if e['loop'] else ['-q:a', '4']
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/wav/{f}.wav', '-c:a', 'libvorbis', *q, f'{OUT}/ogg/{f}.ogg'], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{OUT}/wav/{f}.wav', '-c:a', 'libmp3lame', '-q:a', '4', f'{OUT}/mp3/{f}.mp3'], check=True)
            files.append(f)
            report.append((f, len(x) / SR, db(np.abs(x).max()), level(x, e['level'])))
        manifest[e['id']] = dict(files=files, bus=e['bus'], loop=bool(e['loop']), loopSeconds=e['loop'] or None,
                                 status=e['status'], samples=[int(N(e['loop']))] if e['loop'] else None)
    if not prefixes:
        full = {'version': 1, 'formats': ['ogg', 'mp3'], 'base': 'assets/audio/sfx/', 'sounds': {}}
        for e in sounds.S:
            d = {'files': manifest.get(e['id'], {}).get('files', []), 'bus': e['bus'], 'status': e['status']}
            if e['loop']:
                d['loop'] = True
            full['sounds'][e['id']] = d
        # Two sounds reuse another's file.
        full['sounds']['night.monster']['files'] = full['sounds']['dodge.monster']['files']
        full['sounds']['amb.wolfFar'].update(files=full['sounds']['night.wolves']['files'], volume=0.35)
        json.dump(full, open(f'{OUT}/manifest.json', 'w'), indent=1)
    for f, d, pk, lv in report:
        flag = '  <-- long' if d > 6 and not f.startswith('amb') else ''
        print(f'{f:32s} {d:6.2f}s  peak {pk:6.1f}  level {lv:6.1f}{flag}')
    print(len(report), 'files')


if __name__ == '__main__':
    main(sys.argv[1:])
