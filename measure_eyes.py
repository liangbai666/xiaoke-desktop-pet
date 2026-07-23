import base64, io, re
from PIL import Image

with open(r'C:\Users\HP\WorkBuddy\2026-07-22-15-24-51\images.js', 'r', encoding='utf-8') as f:
    content = f.read()
m = re.search(r"normal\s*:\s*['\"](data:image/png;base64,[^'\"]+)['\"]", content)
b64 = m.group(1).split(',', 1)[1]
img = Image.open(io.BytesIO(base64.b64decode(b64))).convert('RGBA')
W, H = img.size
px = img.load()
print("size", W, H)

ymin, ymax = int(H * 0.20), int(H * 0.45)
xmin, xmax = int(W * 0.26), int(W * 0.74)

def darkest(x0, x1):
    best = None; bx = by = 0
    for y in range(ymin, ymax):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if best is None or lum < best:
                best = lum; bx, by = x, y
    return bx, by, round(best, 1)

lx, ly, ll = darkest(xmin, W // 2)
rx, ry, rl = darkest(W // 2, xmax)
print("left  darkest px", lx, ly, "lum", ll)
print("right darkest px", rx, ry, "lum", rl)
print("frac L", round(lx / W, 3), round(ly / H, 3))
print("frac R", round(rx / W, 3), round(ry / H, 3))

def radius(cx, cy):
    r = 0
    for rr in range(1, 45):
        cnt = 0
        for dy in range(-rr, rr + 1):
            for dx in range(-rr, rr + 1):
                x, y = cx + dx, cy + dy
                if 0 <= x < W and 0 <= y < H:
                    if dx * dx + dy * dy <= rr * rr:
                        cr, cg, cb, ca = px[x, y]
                        if ca > 40 and 0.299 * cr + 0.587 * cg + 0.114 * cb < 95:
                            cnt += 1
        if cnt < (3.14159 * rr * rr) * 0.5:
            return rr - 1
        r = rr
    return r

print("left eye approx radius", radius(lx, ly))
print("right eye approx radius", radius(rx, ry))
