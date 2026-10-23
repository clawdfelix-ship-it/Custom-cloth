from PIL import Image
from collections import deque
import numpy as np

SRC = '/Users/chansiulungfelix/.openclaw/media/qqbot/downloads/890CEE727B1B522FA29498F93C82826C_1790174176305_96c6a1.png'
OUT = 'public/img/logo.png'

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
h, w, _ = a.shape
rgb = a[:, :, :3].astype(float)


def flood(mask, seeds):
    vis = np.zeros((h, w), bool)
    dq = deque()
    for y, x in seeds:
        if mask[y, x] and not vis[y, x]:
            vis[y, x] = 1
            dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = 1
                dq.append((ny, nx))
    return vis


border = ([(0, x) for x in range(w)]
          + [(h - 1, x) for x in range(w)]
          + [(y, 0) for y in range(h)]
          + [(y, w - 1) for y in range(h)])

# 1) outer dark frame
dark = rgb.sum(axis=2) < 260
frame = flood(dark, border)

# 2) white background (frame passable)
mx = rgb.max(axis=2)
mn = rgb.min(axis=2)
whitemask = (((mx - mn) < 60) & (mn > 170)) | frame
white = flood(whitemask, border)

removed = frame | white

# 3) edge band: art pixels within 3px of a removed pixel -> decontaminate white
dist = np.full((h, w), 99)
dq = deque()
for y in range(h):
    for x in range(w):
        if removed[y, x]:
            dist[y, x] = 0
            dq.append((y, x))
while dq:
    y, x = dq.popleft()
    d0 = dist[y, x]
    if d0 >= 3:
        continue
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and dist[ny, nx] > d0 + 1:
            dist[ny, nx] = d0 + 1
            dq.append((ny, nx))

band = (~removed) & (dist <= 4)

# coverage lower bound: observed = a*art + (1-a)*255  =>  a >= (255 - ch)/255
ac = np.clip((255 - mn) / 255, 0, 1)
# soften any edge pixel carrying white (min channel lifted)
light = mn > 100
target = band & light & (ac < 0.98)

new_alpha = np.where(target, np.maximum(ac, 0.12), 1.0)
# decontaminate: art = (observed - (1-a)*255) / a
safe_a = np.maximum(new_alpha, 1e-3)[:, :, None]
decon = (rgb - (1 - new_alpha[:, :, None]) * 255) / safe_a
decon = np.clip(decon, 0, 255)

out_rgb = rgb.copy()
m3 = np.repeat(target[:, :, None], 3, axis=2)
out_rgb = np.where(m3, decon, out_rgb)

out_alpha = np.full((h, w), 255.0)
out_alpha[removed] = 0
out_alpha[target] = new_alpha[target] * 255
# drop near-invisible
out_alpha[out_alpha < 22] = 0

result = np.dstack([out_rgb, out_alpha]).astype(np.uint8)
Image.fromarray(result).save(OUT)
print('removed', int(removed.sum()), 'decontaminated', int(target.sum()))
