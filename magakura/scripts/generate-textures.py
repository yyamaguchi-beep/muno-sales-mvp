"""
禍蔵 演出用テクスチャ生成スクリプト（numpy + Pillow）
実在の資料を模したものではなく、木・和紙・古紙の「質感」だけを手続き生成する。
出力: public/assets/images/textures/*.jpg
"""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "images", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1105)


def value_noise(h, w, cell, seed_rng=rng):
    gh, gw = max(2, h // cell + 2), max(2, w // cell + 2)
    g = seed_rng.random((gh, gw)).astype(np.float32)
    img = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32)[:h, :w] / 255.0


def fbm(h, w, base=256, octaves=6, gain=0.5):
    total = np.zeros((h, w), np.float32)
    amp, norm, cell = 1.0, 0.0, base
    for _ in range(octaves):
        total += amp * value_noise(h, w, max(2, int(cell)))
        norm += amp
        amp *= gain
        cell /= 2
    return total / norm


def save(arr, name, q=90):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(OUT, name), quality=q)
    print("wrote", name, arr.shape)


def colorize(t, stops):
    """t: 0..1 -> RGB using list of (pos, (r,g,b))"""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        m = (t >= p0) & (t <= p1)
        k = ((t - p0) / max(1e-6, p1 - p0))[..., None]
        out = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, out)
    return out


def wood(h, w, name, stops, ring_freq=0.06, warp=60.0, vertical=True, planks=0):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    n1 = fbm(h, w, base=512, octaves=5)
    n2 = fbm(h, w, base=64, octaves=4)
    # 木目: 軸方向に伸びた縞を歪ませる
    axis = xx if vertical else yy
    along = yy if vertical else xx
    stretch = fbm(h, w, base=900, octaves=3)
    g = axis + warp * (n1 - 0.5) * 4 + 18 * np.sin(along * 0.004 + n1 * 6)
    freq_mod = ring_freq * (0.6 + 0.8 * fbm(h, w, base=1200, octaves=2))
    rings = 0.5 + 0.5 * np.sin(g * freq_mod + stretch * 8)
    rings = 0.6 * rings ** 2 + 0.4 * (0.5 + 0.5 * np.sin(g * freq_mod * 3.7 + n2 * 5)) ** 2
    fibers = value_noise(h, w, 3)
    fibers = np.asarray(Image.fromarray((fibers * 255).astype(np.uint8)).resize((w, h)).filter(
        ImageFilter.GaussianBlur(0)), np.float32) / 255
    # 繊維を軸方向に引き伸ばす
    fib_img = Image.fromarray((rng.random((h // 40 + 1, w)) * 255).astype(np.uint8)) if vertical else \
        Image.fromarray((rng.random((h, w // 40 + 1)) * 255).astype(np.uint8))
    fib = np.asarray(fib_img.resize((w, h), Image.BICUBIC), np.float32) / 255
    t = 0.3 * rings + 0.2 * n2 + 0.38 * fib + 0.12 * fibers
    if planks:
        pw = w // planks if vertical else h // planks
        coord = xx if vertical else yy
        seam = np.abs(((coord + 5) % pw) - 0) < 3
        t = np.where(seam, t * 0.25, t)
        # 板ごとの明度差
        idx = (coord // pw).astype(int)
        shade = rng.uniform(0.82, 1.08, size=planks + 2)
        t = t * shade[np.clip(idx, 0, planks + 1)]
    rgb = colorize(t, stops)
    # 煤: 大きなムラ
    soot = fbm(h, w, base=700, octaves=3)
    rgb *= (0.65 + 0.5 * soot)[..., None]
    save(rgb, name)


def washi(h, w, name, base_col=(232, 224, 205), dark=0.0):
    n = fbm(h, w, base=200, octaves=6)
    rgb = np.ones((h, w, 3), np.float32) * np.array(base_col, np.float32)
    rgb *= (0.9 + 0.12 * n)[..., None]
    # 楮の繊維: ランダムな細い曲線
    fib = Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(fib)
    for _ in range(int(w * h / 900)):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ang = rng.uniform(0, np.pi * 2)
        L = rng.uniform(8, 60)
        pts = []
        for s in range(6):
            ang += rng.normal(0, 0.35)
            x += np.cos(ang) * L / 6
            y += np.sin(ang) * L / 6
            pts.append((x, y))
        d.line(pts, fill=int(rng.uniform(40, 140)), width=1)
    fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
    rgb = rgb * (1 - 0.10 * fib[..., None]) + 255 * 0.05 * fib[..., None]
    # 透かしムラ
    cloud = fbm(h, w, base=90, octaves=4)
    rgb *= (0.94 + 0.1 * cloud)[..., None]
    if dark:
        stain = fbm(h, w, base=400, octaves=4)
        rgb *= (1 - dark * np.clip(stain - 0.45, 0, 1) * 2.2)[..., None]
    save(rgb, name)


def old_paper(h, w, name):
    n = fbm(h, w, base=300, octaves=6)
    stains = fbm(h, w, base=500, octaves=4)
    rgb = colorize(0.55 * n + 0.45 * stains, [
        (0.0, (120, 92, 58)), (0.35, (168, 138, 96)), (0.6, (196, 170, 128)), (1.0, (214, 194, 156))])
    # しみ（foxing）
    yy, xx = np.mgrid[0:h, 0:w]
    for _ in range(40):
        cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(4, 40)
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        a = np.clip(1 - dist / r, 0, 1) ** 1.5 * rng.uniform(0.1, 0.35)
        rgb *= (1 - a)[..., None]
    # 縁の焼け
    ex = np.minimum(xx, w - 1 - xx) / (w * 0.5)
    ey = np.minimum(yy, h - 1 - yy) / (h * 0.5)
    e = np.clip(np.minimum(ex, ey) * 6, 0, 1)
    rgb *= (0.55 + 0.45 * e)[..., None]
    fib = fbm(h, w, base=6, octaves=2)
    rgb *= (0.95 + 0.08 * fib)[..., None]
    save(rgb, name)


def plaster(h, w, name):
    """暗い土壁"""
    n = fbm(h, w, base=320, octaves=7, gain=0.55)
    speck = rng.random((h, w)).astype(np.float32)
    t = 0.85 * n + 0.15 * speck
    rgb = colorize(t, [(0.0, (22, 17, 13)), (0.5, (52, 41, 31)), (1.0, (86, 70, 54))])
    save(rgb, name)


def grain_tiles(n=4, h=960, w=540):
    for i in range(n):
        g = rng.normal(0.5, 0.18, (h, w)).astype(np.float32)
        img = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).resize((w * 2, h * 2), Image.BILINEAR)
        img = img.filter(ImageFilter.GaussianBlur(0.7))
        img.convert("RGB").save(os.path.join(OUT, f"grain_{i}.jpg"), quality=85)
        print("wrote", f"grain_{i}.jpg")


if __name__ == "__main__":
    grain_tiles()
    DARK_WOOD = [(0.0, (14, 9, 6)), (0.35, (38, 24, 14)), (0.7, (66, 42, 24)), (1.0, (96, 64, 38))]
    BOX_WOOD = [(0.0, (60, 40, 24)), (0.4, (104, 74, 46)), (0.75, (138, 104, 68)), (1.0, (168, 132, 90))]
    wood(2200, 1300, "wood_wall.jpg", DARK_WOOD, ring_freq=0.05, planks=4)
    wood(1400, 1400, "wood_table.jpg", DARK_WOOD, ring_freq=0.035, vertical=False, planks=3)
    wood(1024, 1024, "wood_box.jpg", BOX_WOOD, ring_freq=0.08, vertical=False)
    washi(1200, 900, "washi.jpg")
    washi(1200, 900, "washi_stained.jpg", base_col=(214, 200, 170), dark=0.3)
    old_paper(1400, 1000, "old_paper.jpg")
    plaster(2000, 1200, "plaster_wall.jpg")
