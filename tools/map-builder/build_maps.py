#!/usr/bin/env python3
"""Build compact measured-surface files for the walkable planets.

Reads public global surveys from /tmp/universe-maps-src and writes
public/maps/<planet>/{relief.png,color.jpg,meta.json}.

relief.png is lossless RGB:
  R = high byte, G = low byte of a 0..65534 quantization of elevation in meters
  65535 (R=G=255) = no data
  B = 0 land, 1 lake, 2 ocean, 3 no data

Row 0 is north. Column 0 is longitude -180°. Sea level is 0 m.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

# Global DEMs are hundreds of megapixels. They are the source data, not a bomb.
Image.MAX_IMAGE_PIXELS = None

SRC = Path("/tmp/universe-maps-src")
OUT = Path("/home/inux/Projects/universe/public/maps")

# Control points that fail the build if a grid is rotated or flipped.
CHECKS = {
    "earth": [
        ("everest", 27.99, 86.93, "gt", 5500),
        ("pacific", 0.0, -160.0, "lt", -2000),
        ("michigan", 44.0, -87.0, "kind", 1),
        ("victoria", -1.0, 33.0, "kind", 1),
        ("caspian", 41.5, 50.5, "notkind", 2),
        ("death-valley", 36.24, -116.83, "notkind", 2),
    ],
    "mars": [
        ("olympus", 18.65, -133.8, "gt", 14000),
        ("hellas", -42.4, 70.5, "lt", -4000),
    ],
    "venus": [
        ("maxwell", 65.2, 3.3, "gt", 6000),
    ],
    "mercury": [
        ("range", None, None, "span", 4000),
    ],
    "pluto": [
        ("span-or-partial", None, None, "partial", 1500),
    ],
}


def sample(arr: np.ndarray, lat: float, lon: float) -> float:
    h, w = arr.shape
    u = (lon + 180.0) / 360.0
    u -= np.floor(u)
    v = min(1.0, max(0.0, (90.0 - lat) / 180.0))
    x = int(u * w) % w
    y = min(h - 1, max(0, int(v * h)))
    return float(arr[y, x])


def resize_area(arr: np.ndarray, width: int, height: int) -> np.ndarray:
    if arr.shape == (height, width):
        return arr.astype(np.float32, copy=False)
    image = Image.fromarray(arr.astype(np.float32), mode="F")
    image = image.resize((width, height), Image.Resampling.BOX)
    return np.array(image, dtype=np.float32)


def resize_nan(arr: np.ndarray, width: int, height: int) -> np.ndarray:
    """Area average that ignores no-data. A cell stays empty unless half its sources are real."""
    if arr.shape == (height, width):
        return arr.astype(np.float32, copy=False)
    valid = np.isfinite(arr).astype(np.float32)
    filled = np.where(np.isfinite(arr), arr, 0).astype(np.float32)
    numer = resize_area(filled, width, height)
    denom = resize_area(valid, width, height)
    out = np.full((height, width), np.nan, dtype=np.float32)
    keep = denom > 0.5
    out[keep] = numer[keep] / np.maximum(denom[keep], 1e-6)
    return out


def to_elevation(arr: np.ndarray, radius_km: float) -> np.ndarray:
    med = float(np.nanmedian(arr))
    if med > 100_000:
        print(f"  subtracting radius datum {radius_km * 1000:.0f} m (median was {med:.0f})")
        return arr - radius_km * 1000.0
    return arr


def orient_with(arr: np.ndarray, score) -> np.ndarray:
    """Try flips and a half-world roll. `score` returns a tuple; larger is better."""
    best = None
    best_key = None
    for flip in (False, True):
        flipped = np.flipud(arr) if flip else arr
        for fraction in (0.0, 0.5):
            shift = int(round(flipped.shape[1] * fraction))
            rolled = np.roll(flipped, shift, axis=1) if shift else flipped
            key = score(rolled)
            print(f"  orient flip={flip} roll={fraction:.1f} score={key}")
            if best_key is None or key > best_key:
                best_key = key
                best = rolled
    if best is None:
        raise RuntimeError("no orientation")
    return best


def earth_score(arr: np.ndarray) -> tuple:
    everest = sample(arr, 27.99, 86.93)
    pacific = sample(arr, 0.0, -160.0)
    # Everest high and the Pacific below sea level.
    return (1 if everest > 5000 and pacific < -2000 else 0, everest, -pacific)


def mars_score(arr: np.ndarray) -> tuple:
    olympus = sample(arr, 18.65, -133.8)
    hellas = sample(arr, -42.4, 70.5)
    return (1 if olympus > 12000 and hellas < -3000 else 0, olympus, -hellas)


def peak_score(lat: float, lon: float):
    def score(arr: np.ndarray) -> tuple:
        value = sample(arr, lat, lon)
        return (value,)
    return score


def read_contiguous_tiff(path: Path) -> np.ndarray | None:
    """Uncompressed strip TIFFs. Pillow drops the last row when every row is its own strip."""
    image = Image.open(path)
    tag = image.tag_v2
    if tag.get(259) != 1 or 273 not in tag or 279 not in tag:
        image.close()
        return None
    offsets = tag[273]
    counts = tag[279]
    if not isinstance(offsets, tuple):
        offsets = (offsets,)
        counts = (counts,)
    if len(offsets) > 1:
        gaps = [offsets[i + 1] - (offsets[i] + counts[i]) for i in range(len(offsets) - 1)]
        if min(gaps) != 0 or max(gaps) != 0:
            image.close()
            return None
    width, height = image.size
    bits = int(tag.get(258, (8,))[0])
    sample_format = int(tag.get(339, (1,))[0])
    image.fp.seek(0)
    endian = image.fp.read(2)
    image.close()
    prefix = "<" if endian == b"II" else ">"
    if bits == 16 and sample_format == 2:
        dtype = prefix + "i2"
    elif bits == 16 and sample_format == 1:
        dtype = prefix + "u2"
    elif bits == 8 and sample_format == 1:
        dtype = "u1"
    else:
        return None
    if int(counts[0]) != width * np.dtype(dtype).itemsize:
        return None
    mapped = np.memmap(path, dtype=dtype, mode="r", offset=int(offsets[0]), shape=(height, width))
    return np.array(mapped)


def load_geotiff(path: Path) -> tuple[np.ndarray, bool]:
    image = Image.open(path)
    arr = read_contiguous_tiff(path)
    if arr is None:
        arr = np.array(image)
    if arr.ndim == 3:
        arr = arr[..., 0]
    arr = arr.astype(np.float32)
    tie = image.tag_v2.get(33922) if hasattr(image, "tag_v2") else None
    scale = image.tag_v2.get(33550) if hasattr(image, "tag_v2") else None
    # Projected meters, simple cylindrical: pixel (0, 0) at lon −180, lat +90
    # means x = −width * scale / 2 and y = +height * scale / 2.
    oriented = False
    if tie and scale and len(tie) >= 5:
        width, height = image.size
        sx, sy = float(scale[0]), float(scale[1])
        x, y = float(tie[3]), float(tie[4])
        oriented = abs(x + width * sx / 2) < sx * 3 and abs(y - height * sy / 2) < sy * 3
    print(f"  {path.name} {arr.shape} min {np.nanmin(arr):.1f} max {np.nanmax(arr):.1f} tie {tie} oriented={oriented}")
    image.close()
    return arr, oriented


def load_mola(path: Path) -> np.ndarray:
    raw = np.fromfile(path, dtype=">i2")
    if raw.size != 5760 * 2880:
        raise RuntimeError(f"MOLA size {raw.size}, expected {5760 * 2880}")
    arr = raw.reshape((2880, 5760)).astype(np.float32)
    print(f"  MOLA {arr.shape} min {arr.min():.0f} max {arr.max():.0f}")
    return arr


def nodata_mask(arr: np.ndarray) -> np.ndarray:
    bad = ~np.isfinite(arr) | (arr < -20000) | (arr > 40000)
    # A sentinel that fills a large fraction of the grid (Pluto's unmapped face).
    flat = arr[::8, ::8]
    finite = flat[np.isfinite(flat)]
    if finite.size:
        sample_vals = np.rint(finite).astype(np.int32)
        values, counts = np.unique(sample_vals, return_counts=True)
        mode = int(values[int(np.argmax(counts))])
        fraction = float(counts.max() / sample_vals.size)
        print(f"  nodata probe mode {mode} covering ~{fraction:.0%} of the stride")
        # A constant that fills the unmapped face. Real plains are not a single extreme value.
        extreme = mode <= -1000 or mode >= 20000 or (mode == 0 and fraction > 0.35)
        if fraction > 0.25 and extreme:
            print(f"  nodata sentinel {mode}")
            bad |= np.rint(arr) == mode
    return bad


def world_ocean(elev: np.ndarray) -> np.ndarray:
    below = elev <= 0
    structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=np.int8)
    labels, _ = ndimage.label(below, structure=structure)
    # The date line is the left and right edge. Join components that touch across it.
    h = labels.shape[0]
    parent: dict[int, int] = {}

    def find(a: int) -> int:
        while parent.get(a, a) != a:
            parent[a] = parent.get(parent[a], parent[a])
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for y in range(h):
        left = int(labels[y, 0])
        right = int(labels[y, -1])
        if left and right:
            union(left, right)
    if parent:
        highest = int(labels.max())
        remap = np.arange(highest + 1)
        for lab in range(1, highest + 1):
            remap[lab] = find(lab)
        labels = remap[labels]

    def lab(lat: float, lon: float) -> int:
        h, w = labels.shape
        u = (lon + 180.0) / 360.0
        v = (90.0 - lat) / 180.0
        x = int(u * w) % w
        y = min(h - 1, max(0, int(v * h)))
        return int(labels[y, x])

    pacific = lab(0.0, -160.0)
    atlantic = lab(20.0, -40.0)
    ocean = np.zeros(elev.shape, dtype=bool)
    if pacific:
        ocean |= labels == pacific
    if atlantic:
        ocean |= labels == atlantic
    return ocean


def lakes_from_specular(elev: np.ndarray, ocean: np.ndarray, specular_path: Path, width: int, height: int) -> np.ndarray:
    image = Image.open(specular_path).convert("L")
    spec = np.array(image.resize((width, height), Image.Resampling.BOX), dtype=np.float32)
    ocean_level = float(spec[ocean].mean()) if ocean.any() else 200.0
    land = (elev > 800) & ~ocean
    land_level = float(spec[land].mean()) if land.any() else 20.0
    threshold = (ocean_level + land_level) * 0.5
    print(f"  specular ocean {ocean_level:.1f} land {land_level:.1f} threshold {threshold:.1f}")
    water = spec >= threshold
    # No depth floor: the Caspian and the rift lakes are bright water whose beds
    # sit hundreds of meters below sea level. A -500 m cut turned those beds into land.
    lakes = water & ~ocean & (elev < 2500)
    # Antarctic ice shelves are only tens of meters up and are bright in this mask.
    # They are ice, not lakes. Inland water on the other continents is equatorward of this.
    lat = 90.0 - (np.arange(height, dtype=np.float32)[:, None] + 0.5) * (180.0 / height)
    lakes &= ~((lat < -62.0) & (elev < 400.0))
    labels, count = ndimage.label(lakes)
    if count:
        counts = np.bincount(labels.ravel())
        small = counts < 8
        small[0] = False
        lakes[small[labels]] = False
    print(f"  lake pixels {int(lakes.sum())}")
    return lakes


def save_relief(path: Path, elev: np.ndarray, kind: np.ndarray, nodata: np.ndarray) -> tuple[float, float]:
    valid = ~nodata & np.isfinite(elev)
    if not valid.any():
        raise RuntimeError(f"no valid elevations for {path}")
    min_m = float(elev[valid].min())
    max_m = float(elev[valid].max())
    # The viewer stores meters in int16. A planetary-radius datum would wrap.
    if min_m < -32000 or max_m > 32000:
        raise RuntimeError(f"{path} elevation {min_m:.0f}..{max_m:.0f} m does not fit int16; datum was not removed")
    span = max(max_m - min_m, 1.0)
    q = np.zeros(elev.shape, dtype=np.uint32)
    q[valid] = np.clip(np.rint((elev[valid] - min_m) / span * 65534.0), 0, 65534).astype(np.uint32)
    q[nodata] = 65535
    hi = ((q >> 8) & 255).astype(np.uint8)
    lo = (q & 255).astype(np.uint8)
    rgb = np.dstack([hi, lo, kind.astype(np.uint8)])
    Image.fromarray(rgb, mode="RGB").save(path, format="PNG", compress_level=3)
    # Round-trip a few pixels so a bad quantizer fails here.
    back = min_m + (q.astype(np.float32) / 65534.0) * span
    err = np.max(np.abs(back[valid] - elev[valid]))
    print(f"  relief {path.name} {elev.shape} {min_m:.0f}..{max_m:.0f} m quantize err {err:.2f} m file {path.stat().st_size / 1e6:.1f} MB")
    if err > 2.0:
        raise RuntimeError(f"quantize error {err}")
    return min_m, max_m


def save_color(src: Path, dest: Path, width: int = 4096, height: int = 2048, pluto: bool = False) -> None:
    raw = read_contiguous_tiff(src) if src.suffix.lower() in {".tif", ".tiff"} else None
    if raw is not None:
        if raw.ndim == 2:
            image = Image.fromarray(raw if raw.dtype == np.uint8 else np.clip(raw, 0, 255).astype(np.uint8), mode="L")
        else:
            image = Image.fromarray(raw.astype(np.uint8), mode="RGB")
    else:
        image = Image.open(src)
        image.load()
    if pluto and image.mode not in ("RGB", "RGBA"):
        gray = np.array(image, dtype=np.float32)
        if gray.ndim == 3:
            gray = gray[..., 0]
        scale = 255.0 / max(float(np.percentile(gray, 99.5)), 1.0)
        gray = np.clip(gray * scale, 0, 255)
        rgb = np.dstack([
            np.clip(gray * 1.06, 0, 255),
            np.clip(gray * 0.94, 0, 255),
            np.clip(gray * 0.80, 0, 255),
        ]).astype(np.uint8)
        image = Image.fromarray(rgb, mode="RGB")
    else:
        image = image.convert("RGB")
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    image.save(dest, quality=92, optimize=True)
    print(f"  color {dest.name} {width}x{height} {dest.stat().st_size / 1e6:.1f} MB")


def kind_at(kind: np.ndarray, lat: float, lon: float) -> int:
    h, w = kind.shape
    u = (lon + 180.0) / 360.0
    u -= np.floor(u)
    v = min(1.0, max(0.0, (90.0 - lat) / 180.0))
    x = int(u * w) % w
    y = min(h - 1, max(0, int(v * h)))
    return int(kind[y, x])


def check_planet(name: str, elev: np.ndarray, kind: np.ndarray) -> None:
    for label, lat, lon, op, expect in CHECKS[name]:
        if op == "span":
            span = float(np.nanmax(elev) - np.nanmin(elev))
            print(f"  check {label} span {span:.0f} m")
            if span < expect:
                raise RuntimeError(f"{name} relief span {span:.0f} m")
            continue
        if op == "partial":
            finite = np.isfinite(elev)
            span = float(elev[finite].max() - elev[finite].min()) if finite.any() else 0
            print(f"  check {label} span {span:.0f} m")
            if span < expect:
                raise RuntimeError(f"{name} relief span {span:.0f} m")
            continue
        value = sample(elev, lat, lon)
        got_kind = kind_at(kind, lat, lon)
        print(f"  check {label} {value:.0f} m kind {got_kind}")
        if op == "gt" and not value > expect:
            raise RuntimeError(f"{name} {label} {value:.0f} m, wanted > {expect}")
        if op == "lt" and not value < expect:
            raise RuntimeError(f"{name} {label} {value:.0f} m, wanted < {expect}")
        if op == "kind" and got_kind != expect:
            raise RuntimeError(f"{name} {label} kind {got_kind}, wanted {expect}")
        if op == "notkind" and got_kind == expect:
            raise RuntimeError(f"{name} {label} should not be kind {expect}")


def write_planet(name: str, elev: np.ndarray, kind: np.ndarray, nodata: np.ndarray, color_src: Path, radius_km: float, sources: str, pluto_color: bool = False) -> None:
    dest = OUT / name
    dest.mkdir(parents=True, exist_ok=True)
    check_planet(name, elev, kind)
    min_m, max_m = save_relief(dest / "relief.png", elev, kind, nodata)
    save_color(color_src, dest / "color.jpg", pluto=pluto_color)
    meta = {
        "width": int(elev.shape[1]),
        "height": int(elev.shape[0]),
        "min": min_m,
        "max": max_m,
        "radiusKm": radius_km,
        "sources": sources,
    }
    (dest / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {dest}")


def build_earth() -> None:
    arr, oriented = load_geotiff(SRC / "etopo.tif")
    arr = to_elevation(arr, 6371.0)
    if oriented:
        print("  keeping the GeoTIFF's north-up, lon -180 frame")
    else:
        arr = orient_with(arr, earth_score)
    elev = resize_area(arr, 8192, 4096)
    nodata = nodata_mask(elev)
    ocean = world_ocean(np.where(nodata, 1.0, elev))
    lakes = lakes_from_specular(elev, ocean, SRC / "earth-spec.tif", 8192, 4096)
    kind = np.zeros(elev.shape, dtype=np.uint8)
    kind[lakes] = 1
    kind[ocean] = 2
    kind[nodata] = 3
    write_planet(
        "earth",
        elev,
        kind,
        nodata,
        SRC / "earth-day.jpg",
        6371.0,
        "Elevation: NOAA NCEI ETOPO 2022 ice surface, 60 arc-second, area-averaged (DOI 10.25921/fd45-gt74). "
        "Ocean mask: connected bathymetry. Lakes: Solar System Scope 8k specular map (CC BY 4.0). "
        "Color: Solar System Scope 8k earth daymap (CC BY 4.0), resized. Vertical scale is exaggerated in the viewer.",
    )


def build_mars() -> None:
    arr = load_mola(SRC / "mars.img")
    arr = orient_with(arr, mars_score)
    elev = arr  # 5760 x 2880, about 3.7 km per pixel
    nodata = nodata_mask(elev)
    kind = np.zeros(elev.shape, dtype=np.uint8)
    kind[nodata] = 3
    write_planet(
        "mars",
        elev,
        kind,
        nodata,
        SRC / "mars-color.jpg",
        3389.5,
        "Elevation: NASA MGS MOLA MEGDR topography, 16 pixels per degree (megt90n000eb), public domain. "
        "Color: Solar System Scope 8k Mars (CC BY 4.0), resized. Vertical scale is exaggerated in the viewer.",
    )


def build_venus() -> None:
    arr, oriented = load_geotiff(SRC / "venus.tif")
    arr = to_elevation(arr, 6051.8)
    if oriented:
        print("  keeping the GeoTIFF's north-up, lon -180 frame")
    else:
        arr = orient_with(arr, peak_score(65.2, 3.3))
    elev = resize_area(arr, 8192, 4096) if arr.shape != (4096, 8192) else arr
    if elev.shape[0] > 4096:
        elev = resize_area(arr, 8192, 4096)
    nodata = nodata_mask(elev)
    kind = np.zeros(elev.shape, dtype=np.uint8)
    kind[nodata] = 3
    write_planet(
        "venus",
        elev,
        kind,
        nodata,
        SRC / "venus-color.jpg",
        6051.8,
        "Elevation: NASA Magellan Global Topography 4641 m (GTDR v2), USGS, public domain. "
        "Color: Solar System Scope 8k Magellan radar mosaic (CC BY 4.0), resized. Not an optical photograph. "
        "Vertical scale is exaggerated in the viewer.",
    )


def build_mercury() -> None:
    arr, oriented = load_geotiff(SRC / "mercury.tif")
    arr = to_elevation(arr, 2439.7)
    if oriented:
        print("  keeping the GeoTIFF's north-up, lon -180 frame")
    else:
        # Highest terrain in this DEM sits near 64N, 112E in the published grids.
        arr = orient_with(arr, peak_score(64.0, 112.0))
    elev = resize_area(arr, 8192, 4096)
    nodata = nodata_mask(elev)
    kind = np.zeros(elev.shape, dtype=np.uint8)
    kind[nodata] = 3
    write_planet(
        "mercury",
        elev,
        kind,
        nodata,
        SRC / "mercury-color.jpg",
        2439.7,
        "Elevation: USGS MESSENGER Global DEM 665 m v2, public domain. "
        "Color: Solar System Scope 8k Mercury (CC BY 4.0), resized. Vertical scale is exaggerated in the viewer.",
    )


def build_pluto() -> None:
    arr, oriented = load_geotiff(SRC / "pluto-dem.tif")
    arr = to_elevation(arr, 1188.3)
    if oriented:
        print("  keeping the GeoTIFF's north-up, lon -180 frame")
    else:
        # Tenzing Montes, on the south-west rim of Sputnik Planitia, ~6 km.
        arr = orient_with(arr, peak_score(-15.0, 175.0))
    # Mask before the downsample. Averaging the -32768 sentinel with real
    # pixels invented pits tens of kilometers deep along the data edge.
    missing = nodata_mask(arr)
    clean = np.where(missing, np.nan, arr.astype(np.float32))
    elev_nan = resize_nan(clean, 4096, 2048)
    nodata = ~np.isfinite(elev_nan)
    kind = np.zeros(elev_nan.shape, dtype=np.uint8)
    kind[nodata] = 3
    # Unmapped faces stay smooth. Don't invent relief there.
    elev = np.where(nodata, 0.0, elev_nan)
    write_planet(
        "pluto",
        elev,
        kind,
        nodata,
        SRC / "pluto-color.tif",
        1188.3,
        "Elevation and mosaic: NASA New Horizons global DEM and LORRI/MVIC mosaic, 300 m, July 2017, via USGS, public domain. "
        "Topography covers the encounter hemisphere; the rest is unmarked and is drawn smooth. "
        "The mosaic is panchromatic with a mild warm display grade, not a mineral map. "
        "Vertical scale is exaggerated in the viewer.",
        pluto_color=True,
    )


BUILDERS = {
    "earth": build_earth,
    "mars": build_mars,
    "venus": build_venus,
    "mercury": build_mercury,
    "pluto": build_pluto,
}


if __name__ == "__main__":
    names = sys.argv[1:] or list(BUILDERS)
    for name in names:
        print(f"\n== {name} ==")
        BUILDERS[name]()
