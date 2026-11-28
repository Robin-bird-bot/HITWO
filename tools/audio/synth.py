"""A small synth toolkit for Hike in the Woods' sound effects.

Everything is numpy at 44.1 kHz. Sounds are mono float arrays until `stereo()`
or `verb()` makes them (n, 2). Two families:
  - park: wood, marimba, kalimba, paper, cloth, nature (the New Deal park side)
  - device: soft pulse-wave bleeps (the TrailMate side)
"""
import numpy as np
from scipy import signal

SR = 44100
_rng = np.random.default_rng(1)


def seed(s):
    global _rng
    _rng = np.random.default_rng(s)


def R():
    return _rng


def N(d):
    return max(1, int(round(d * SR)))


def T(d):
    return np.arange(N(d)) / SR


def hz(m):
    """MIDI note to Hz."""
    return 440.0 * 2 ** ((m - 69) / 12)


# ── envelopes ──────────────────────────────────────────────────────────────
def expdec(d, tau, a=0.002):
    t = T(d)
    e = np.exp(-t / tau)
    if a > 0:
        e *= np.clip(t / a, 0, 1)
    return e


def adsr(d, a=0.01, dcy=0.1, s=0.6, r=0.1):
    n = N(d)
    e = np.full(n, s, float)
    na, nd, nr = N(a), N(dcy), N(r)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na)
    if na + nd < n:
        e[na:na + nd] = np.linspace(1, s, nd)
    nr = min(nr, n)
    e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def swell(d, peak=0.5, a_curve=2.0, r_curve=2.0):
    """Rises to 1 at `peak` (0..1 of the length) and falls back to 0."""
    t = np.linspace(0, 1, N(d))
    up = np.clip(t / peak, 0, 1) ** a_curve
    dn = np.clip((1 - t) / (1 - peak), 0, 1) ** r_curve
    return np.minimum(up, dn)


def fade(x, a=0.003, r=0.01):
    x = x.copy()
    na, nr = min(N(a), len(x)), min(N(r), len(x))
    x[:na] *= np.linspace(0, 1, na)[:, None] if x.ndim == 2 else np.linspace(0, 1, na)
    x[len(x) - nr:] *= np.linspace(1, 0, nr)[:, None] if x.ndim == 2 else np.linspace(1, 0, nr)
    return x


# ── oscillators ────────────────────────────────────────────────────────────
def _freq(f, d):
    n = N(d)
    if np.ndim(f) == 0:
        return np.full(n, float(f))
    f = np.asarray(f, float)
    if len(f) != n:
        f = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(f)), f)
    return f


def glide(f0, f1, d, curve='exp'):
    t = np.linspace(0, 1, N(d))
    if curve == 'exp':
        return f0 * (f1 / f0) ** t
    return f0 + (f1 - f0) * t


def _blep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1
    m = t > 1 - dt
    x = (t[m] - 1) / dt[m]
    y[m] = x * x + x + x + 1
    return y


def osc(f, d, wave='sine', duty=0.5, vib=0.0, vib_rate=5.0, phase=0.0):
    f = _freq(f, d)
    if vib:
        f = f * (1 + vib * np.sin(2 * np.pi * vib_rate * T(d)))
    ph = np.cumsum(f) / SR + phase
    if wave == 'sine':
        return np.sin(2 * np.pi * ph)
    t = ph % 1.0
    dt = np.clip(f / SR, 1e-6, 0.5)
    if wave == 'saw':
        return 2 * t - 1 - _blep(t, dt)
    if wave == 'square':
        y = np.where(t < duty, 1.0, -1.0)
        y += _blep(t, dt) - _blep((t - duty) % 1.0, dt)
        return y
    if wave == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(2 * np.pi * ph))
    raise ValueError(wave)


def fm(f, d, ratio=1.4, index=3.0, itau=0.3, wave_mod='sine'):
    """A simple FM voice: bells when ratio is inharmonic and the index falls."""
    t = T(d)
    f = _freq(f, d)
    ph_m = np.cumsum(f * ratio) / SR
    idx = index * np.exp(-t / itau) if itau else index
    ph_c = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph_c + idx * np.sin(2 * np.pi * ph_m))


# ── noise ──────────────────────────────────────────────────────────────────
def white(d):
    return np.clip(_rng.standard_normal(N(d)) * 0.35, -1, 1)


def pink(d):
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    x = signal.lfilter(b, a, _rng.standard_normal(N(d) + 2000))[2000:]
    return x / (np.max(np.abs(x)) + 1e-9)


def brown(d):
    x = signal.lfilter([1], [1, -0.997], _rng.standard_normal(N(d) + 4000))[4000:]
    x = signal.lfilter([1, -1], [1, -0.995], x)  # take out the drift
    return x / (np.max(np.abs(x)) + 1e-9)


# ── filters ────────────────────────────────────────────────────────────────
def _sos(kind, f, order):
    if kind == 'band':
        lo, hi = f
        return signal.butter(order, [max(lo, 10) / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos')
    return signal.butter(order, min(f, SR / 2 - 100) / (SR / 2), kind, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(_sos('low', f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos('high', f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos('band', (lo, hi), order), x, axis=0)


def reso(x, f, q=8):
    b, a = signal.iirpeak(min(f, SR / 2 - 200) / (SR / 2), q)
    return signal.lfilter(b, a, x)


def shape(x, centers, bw=0.6, kind='band', floor=0.0):
    """Time-varying filter through the STFT: `centers` is Hz over time (any length).
    kind='band' keeps a Gaussian band `bw` octaves wide; 'low' rolls off above."""
    nper = 1024
    f, t, Z = signal.stft(x, SR, nperseg=nper, noverlap=nper * 3 // 4)
    c = np.interp(np.linspace(0, 1, Z.shape[1]), np.linspace(0, 1, len(np.atleast_1d(centers))), np.atleast_1d(centers))
    ff = np.maximum(f, 1.0)[:, None]
    oct_ = np.log2(ff / c[None, :])
    if kind == 'band':
        m = np.exp(-0.5 * (oct_ / (bw / 2)) ** 2)
    else:
        m = 1 / (1 + np.maximum(oct_, 0) ** 2 * (1 / bw) ** 2 * 4)
    m = floor + (1 - floor) * m
    _, y = signal.istft(Z * m, SR, nperseg=nper, noverlap=nper * 3 // 4)
    y = y[:len(x)]
    if len(y) < len(x):
        y = np.pad(y, (0, len(x) - len(y)))
    return y


# ── building blocks ────────────────────────────────────────────────────────
def place(dst, src, at):
    """Adds src into dst at time `at` (seconds), growing dst if needed."""
    i = N(at) if at > 0 else 0
    need = i + len(src)
    if need > len(dst):
        pad = np.zeros((need - len(dst),) + dst.shape[1:])
        dst = np.concatenate([dst, pad])
    if src.ndim == 1 and dst.ndim == 2:
        src = np.stack([src, src], 1)
    dst[i:i + len(src)] += src
    return dst


def mix(*parts):
    """mix((sound, at), (sound, at), ...) or plain sounds at 0."""
    out = np.zeros(1)
    st = any((p[0] if isinstance(p, tuple) else p).ndim == 2 for p in parts)
    if st:
        out = np.zeros((1, 2))
    for p in parts:
        s, at = (p if isinstance(p, tuple) else (p, 0.0))
        out = place(out, s, at)
    return out


def modal(f0, ratios, decays, amps=None, d=None, click=0.0, click_bw=(2000, 8000)):
    d = d or max(decays) * 5
    t = T(d)
    amps = amps or [1.0 / (i + 1) for i in range(len(ratios))]
    y = np.zeros(len(t))
    for r, dc, a in zip(ratios, decays, amps):
        if f0 * r < SR / 2 - 500:
            y += a * np.sin(2 * np.pi * f0 * r * t + _rng.uniform(0, 1)) * np.exp(-t / dc)
    y *= np.clip(t / 0.0015, 0, 1)
    if click:
        c = bp(white(0.006), *click_bw) * expdec(0.006, 0.0015, 0)
        y[:len(c)] += click * c / (np.max(np.abs(c)) + 1e-9)
    return y


def wood(f0=900, d=0.18, bright=1.0):
    return modal(f0, [1, 2.68, 4.31, 6.7], [0.045, 0.022, 0.012, 0.007], [1, 0.45 * bright, 0.25 * bright, 0.1 * bright], d=d, click=0.5 * bright)


def marimba(m, d=0.9, soft=1.0):
    f = hz(m)
    return modal(f, [1, 3.93, 9.2], [0.45, 0.09, 0.03], [1, 0.25 * soft, 0.06 * soft], d=d, click=0.15)


def kalimba(m, d=1.2):
    f = hz(m)
    return modal(f, [1, 5.9, 2.0], [0.7, 0.05, 0.25], [1, 0.22, 0.12], d=d, click=0.12)


def glock(m, d=1.6):
    f = hz(m)
    return modal(f, [1, 2.756, 5.404, 8.933], [0.9, 0.3, 0.12, 0.05], [1, 0.3, 0.12, 0.05], d=d, click=0.05)


def bell(f, d=1.5, ratio=1.41, index=4.0, itau=0.25, tau=0.5):
    return fm(f, d, ratio, index, itau) * expdec(d, tau, 0.001)


def glass(f, d=0.6, tau=0.25):
    return modal(f, [1, 2.71, 5.15, 8.4], [tau, tau * 0.5, tau * 0.25, tau * 0.12], [1, 0.4, 0.2, 0.08], d=d, click=0.08)


def chip(m, d=0.08, duty=0.25, wave='square', vol=1.0, slide=None, soft=4500):
    """A soft TrailMate bleep: a pulse wave, low-passed so it never gets harsh."""
    f = hz(m) if slide is None else glide(hz(m), hz(slide), d)
    y = osc(f, d, wave, duty) * adsr(d, 0.002, d * 0.3, 0.6, min(0.03, d * 0.4))
    return lp(y, soft) * vol


def chips(notes, step=0.07, d=0.07, **k):
    out = np.zeros(1)
    for i, m in enumerate(notes):
        if m is None:
            continue
        out = place(out, chip(m, d, **k), i * step)
    return out


def tones(fn, notes, step):
    out = np.zeros(1)
    for i, m in enumerate(notes):
        if m is not None:
            out = place(out, fn(m), i * step)
    return out


def burst(d, lo, hi, tau=None, a=0.001, color='white'):
    src = {'white': white, 'pink': pink, 'brown': brown}[color](d)
    y = bp(src, lo, hi) if hi < SR / 2 - 200 else hp(src, lo)
    return y * expdec(d, tau or d / 4, a)


def grains(d, rate, lo, hi, glen=(0.002, 0.012), env=None, amp=(0.3, 1.0)):
    """Random short noise grains: rustles, crunch, crackle, gravel."""
    out = np.zeros(N(d) + N(0.05))
    count = _rng.poisson(rate * d)
    for _ in range(count):
        at = _rng.uniform(0, d)
        g = _rng.uniform(*glen)
        s = bp(white(g + 0.004), lo, hi) * expdec(g + 0.004, g / 3, 0.0005)
        a = _rng.uniform(*amp)
        if env is not None:
            a *= env[min(len(env) - 1, int(at / d * len(env)))]
        out = place(out, s * a, at)
    return out[:N(d) + N(0.05)]


def clicks(d, rate, f_lo, f_hi, q=6, amp=(0.4, 1.0), env=None):
    """Resonant little ticks (claws, crackle pops, zipper teeth)."""
    out = np.zeros(N(d) + N(0.05))
    count = _rng.poisson(rate * d)
    for _ in range(count):
        at = _rng.uniform(0, d)
        f = _rng.uniform(f_lo, f_hi)
        s = reso(np.r_[1.0, np.zeros(N(0.02))], f, q)
        a = _rng.uniform(*amp)
        if env is not None:
            a *= env[min(len(env) - 1, int(at / d * len(env)))]
        out = place(out, s * a, at)
    return out[:N(d) + N(0.05)]


def creak(d, rate=(40, 110), forms=(420, 980, 1800), env=None):
    """Stick-slip creak: an impulse train with a wandering rate through wood resonances."""
    n = N(d)
    r = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, 6), _rng.uniform(*rate, 6))
    r = r * (1 + 0.35 * np.interp(np.linspace(0, 1, n), np.linspace(0, 1, 60), _rng.standard_normal(60)))
    r = np.clip(r, 5, None)
    ph = np.cumsum(r) / SR
    imp = np.diff(np.floor(ph), prepend=0) * _rng.uniform(0.6, 1, n)
    y = sum(reso(imp, f, 10) * (1 / (i + 1)) for i, f in enumerate(forms))
    e = swell(d, 0.3) if env is None else env
    return y * e


def zipper(d, f0=380, f1=520, band=(1800, 7000)):
    """Teeth clicking past the slider: a jittery impulse train."""
    n = N(d)
    rate = glide(f0, f1, d, 'lin') * (1 + 0.15 * _rng.standard_normal(n).cumsum() / np.sqrt(n))
    ph = np.cumsum(np.abs(rate)) / SR
    imp = np.diff(np.floor(ph), prepend=0) * _rng.uniform(0.5, 1, n)
    y = bp(imp, *band) + 0.3 * bp(white(d), 1500, 5000) * 0.2
    return y * swell(d, 0.2, 0.5, 1.0)


def whoosh(d=0.35, f0=600, f1=3000, bw=1.2, color='pink', peak=0.55):
    src = {'white': white, 'pink': pink, 'brown': brown}[color](d)
    return shape(src, glide(f0, f1, d), bw) * swell(d, peak)


def thump(f=70, d=0.18, tau=0.05, drop=0.6):
    return osc(glide(f * 1.6, f * drop, d), d) * expdec(d, tau, 0.001) + 0.3 * lp(white(d), 300) * expdec(d, tau / 3, 0.0005)


def chord_pad(notes, d, wave='saw', cutoff=1800, a=0.3, r=0.6, detune=0.004):
    y = np.zeros(N(d))
    for m in notes:
        for dt_ in (-detune, detune):
            y += osc(hz(m) * (1 + dt_), d, wave)
    y = lp(y, cutoff) * adsr(d, a, 0.2, 0.8, r)
    return y / max(1, len(notes))


# ── space ──────────────────────────────────────────────────────────────────
def stereo(x, pan=0.0):
    if x.ndim == 2:
        return x
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def verb(x, t60=1.0, mix_=0.2, bright=6000, pre=0.012, width=1.0):
    x = stereo(x)
    n = N(t60 * 1.2)
    t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        ir = _rng.standard_normal(n) * np.exp(-6.9 * t / t60)
        ir = lp(ir, bright)
        ir[:N(pre)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2) + 1e-9))
    wet = np.stack([signal.fftconvolve(x[:, 0], irs[0]), signal.fftconvolve(x[:, 1], irs[1] if width else irs[0])], 1)
    dry = np.pad(x, ((0, len(wet) - len(x)), (0, 0)))
    return dry * (1 - mix_ * 0.5) + wet * mix_


def echo(x, delay=0.18, fb=0.35, n=4, damp=3000):
    out = x.copy()
    tap = x
    for i in range(1, n + 1):
        tap = lp(tap, damp) * fb
        out = place(out, tap, delay * i)
    return out


def fit(x, d):
    n = N(d)
    if len(x) >= n:
        return x[:n]
    return np.pad(x, ((0, n - len(x)),) + ((0, 0),) * (x.ndim - 1))


def trim(x, thresh=1e-4, tail=0.02):
    a = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    idx = np.where(a > thresh * a.max())[0]
    if len(idx) == 0:
        return x
    end = min(len(x), idx[-1] + N(tail))
    return x[:end]


def loopify(x, xfade=1.0):
    """Makes a seamless loop: the last `xfade` seconds fade into the start."""
    n = N(xfade)
    head, body = x[:n], x[n:]
    tail = body[-n:]
    w = np.linspace(0, 1, n)
    if x.ndim == 2:
        w = w[:, None]
    body = body.copy()
    body[-n:] = tail * np.cos(w * np.pi / 2) + head * np.sin(w * np.pi / 2)
    return body
