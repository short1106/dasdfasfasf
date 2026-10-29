# Erzeugt den Test-Song für die Musik-/Disko-Tests: track.wav, track.webm (Testbild + Ton) und track-audio.webm
# Ablauf (Sekunden): 0–6 nur Melodie (Stereo-Flächen) · ab 6 Kicks (120 BPM) + Bass · 8–13,5 „Stimme“ (Mitte)
#                   14–16 Pause ohne Bass · 16 Drop · 18–26 Stimme · danach Kicks ohne Stimme
# Braucht numpy und ffmpeg. Aufruf: python3 make-track.py
import os, subprocess, wave
import numpy as np

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sr = 44100; dur = 32; n = sr * dur; t = np.arange(n) / sr
L = np.zeros(n); R = np.zeros(n)

# Melodie (Seiten): links und rechts verschiedene Töne, Akkordwechsel alle 2 s
for k, (f1, f2) in enumerate([(440, 330), (392, 294), (349, 262), (330, 247)] * 4):
    e = np.zeros(n); i0 = int(k * 2.0 * sr); i1 = min(n, int((k * 2.0 + 2) * sr)); e[i0:i1] = 0.18
    L += e * np.sin(2 * np.pi * f1 * t) * 0.7; R += e * np.sin(2 * np.pi * f2 * t + 1) * 0.7

# Kicks 120 BPM ab 6 s, Pause 14–16 s, ab 16 s etwas lauter (Drop)
for b in np.arange(6, dur, 0.5):
    if 14 <= b < 16: continue
    amp = 0.9 if b < 14 else 1.0
    x = t - b; m = (x >= 0) & (x < 0.35)
    f = 45 + 80 * np.exp(-x[m] * 30)
    k = amp * np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-x[m] * 9)
    L[m] += k; R[m] += k

# Bassline unter den Kicks
bass = np.where(((t >= 6) & (t < 14)) | (t >= 16), 0.25 * np.sin(2 * np.pi * 55 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 2 * t)), 0)
L += bass; R += bass

# "Stimme": exakt in der Mitte, harmonisch mit Vibrato
v = np.zeros(n)
for a, b in [(8, 13.5), (18, 26)]:
    m = (t >= a) & (t < b)
    f0 = 220 * (1 + 0.02 * np.sin(2 * np.pi * 5.5 * t[m]))
    ph = 2 * np.pi * np.cumsum(f0) / sr
    v[m] = sum((0.5 / h) * np.sin(h * ph) * (1.6 if h in (3, 4, 9, 10) else 1) for h in range(1, 14)) * 0.22
L += v; R += v

mx = max(abs(L).max(), abs(R).max()); L /= mx * 1.05; R /= mx * 1.05
w = wave.open('track.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((np.stack([L, R], 1) * 32767).astype('<i2').tobytes()); w.close()

ff = ['ffmpeg', '-loglevel', 'error', '-y']
subprocess.run(ff + ['-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=30:duration=32', '-i', 'track.wav',
                     '-c:v', 'libvpx', '-b:v', '1500k', '-c:a', 'libopus', '-b:a', '128k', '-shortest', 'track.webm'], check=True)
subprocess.run(ff + ['-i', 'track.wav', '-c:a', 'libopus', '-b:a', '128k', 'track-audio.webm'], check=True)
print('track.webm + track-audio.webm erzeugt')
