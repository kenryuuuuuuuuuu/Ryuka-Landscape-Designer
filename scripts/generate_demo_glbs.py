#!/usr/bin/env python3
"""Generate and validate Ryuka's deterministic, project-original GLB assets."""
from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "models"
MATERIALS = {
    "wall": ([0.45, 0.52, 0.54, 1], 0.08, 0.72),
    "roof": ([0.18, 0.22, 0.23, 1], 0.16, 0.58),
    "wood": ([0.34, 0.20, 0.11, 1], 0.02, 0.82),
    "woodLight": ([0.48, 0.31, 0.17, 1], 0.01, 0.76),
    "metal": ([0.28, 0.31, 0.30, 1], 0.55, 0.42),
}


def box(store, material, center, size, bevel=0.0):
    """Append a box. bevel is represented by a slightly inset top cap."""
    cx, cy, cz = center
    sx, sy, sz = size
    y0, y1 = cy - sy / 2, cy + sy / 2
    inset = min(bevel, sx * 0.12, sz * 0.12)
    rings = [(-sx / 2, -sz / 2), (sx / 2, -sz / 2), (sx / 2, sz / 2), (-sx / 2, sz / 2)]
    top = [(x * (sx - 2 * inset) / sx, z * (sz - 2 * inset) / sz) for x, z in rings]
    faces = []
    faces.append(([(rings[i][0], y0, rings[i][1]) for i in range(4)], (0, -1, 0)))
    faces.append(([(top[i][0], y1, top[i][1]) for i in reversed(range(4))], (0, 1, 0)))
    normals = [(0, 0, -1), (1, 0, 0), (0, 0, 1), (-1, 0, 0)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append(([(rings[i][0], y0, rings[i][1]), (top[i][0], y1, top[i][1]),
                       (top[j][0], y1, top[j][1]), (rings[j][0], y0, rings[j][1])], normals[i]))
    mesh = store.setdefault(material, {"positions": [], "normals": [], "indices": []})
    for vertices, normal in faces:
        start = len(mesh["positions"])
        mesh["positions"].extend((cx + x, y, cz + z) for x, y, z in vertices)
        mesh["normals"].extend([normal] * 4)
        mesh["indices"].extend((start, start + 1, start + 2, start, start + 2, start + 3))


def shed(high):
    s = {}
    box(s, "wall", (0, 1.08, 0), (3.6, 2.16, 2.7), 0.025)
    box(s, "roof", (0, 2.28, 0), (3.95, 0.24, 3.05), 0.04)
    box(s, "wood", (0, 0.88, 1.365), (0.90, 1.76, 0.08))
    if high:
        for x in (-1.72, -0.86, 0, 0.86, 1.72):
            box(s, "metal", (x, 1.08, -1.356), (0.025, 2.05, 0.025))
        box(s, "metal", (0.32, 0.90, 1.42), (0.06, 0.12, 0.05))
        box(s, "roof", (0, 2.43, 0), (3.72, 0.07, 0.10))
        box(s, "roof", (-1.91, 2.28, 0), (0.08, 0.28, 2.88))
        box(s, "roof", (1.91, 2.28, 0), (0.08, 0.28, 2.88))
    return s


def bench(high):
    s = {}
    if high:
        for z in (-0.15, 0, 0.15):
            box(s, "woodLight", (0, 0.46, z), (1.6, 0.065, 0.13), 0.012)
    else:
        box(s, "woodLight", (0, 0.46, 0), (1.6, 0.08, 0.45), 0.015)
    for x in (-0.60, 0.60):
        box(s, "wood", (x, 0.23, 0), (0.15, 0.46, 0.38), 0.01)
    if high:
        box(s, "wood", (0, 0.27, 0), (1.35, 0.10, 0.12), 0.01)
    return s


def raised_bed(high):
    s = {}
    thickness = 0.10 if high else 0.12
    box(s, "woodLight", (0, 0.19, -0.55), (2.4, 0.38, thickness), 0.012)
    box(s, "woodLight", (0, 0.19, 0.55), (2.4, 0.38, thickness), 0.012)
    box(s, "woodLight", (-1.15, 0.19, 0), (thickness, 0.38, 1.10), 0.012)
    box(s, "woodLight", (1.15, 0.19, 0), (thickness, 0.38, 1.10), 0.012)
    if high:
        for x in (-1.15, 1.15):
            for z in (-0.55, 0.55):
                box(s, "wood", (x, 0.21, z), (0.14, 0.42, 0.14), 0.012)
        for y in (0.105, 0.285):
            box(s, "woodLight", (0, y, -0.555), (2.16, 0.15, 0.08))
            box(s, "woodLight", (0, y, 0.555), (2.16, 0.15, 0.08))
    return s


def align4(data, pad=b"\x00"):
    return data + pad * ((-len(data)) % 4)


def validate_winding(store):
    """Assert every indexed triangle faces in the direction of its NORMAL."""
    for material, data in store.items():
        positions = data["positions"]
        normals = data["normals"]
        indices = data["indices"]
        assert len(indices) % 3 == 0
        for offset in range(0, len(indices), 3):
            triangle = indices[offset:offset + 3]
            a, b, c = (positions[index] for index in triangle)
            ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
            ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
            geometric = (
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0]
            )
            magnitude_sq = sum(component * component for component in geometric)
            assert magnitude_sq > 1e-18, f"degenerate triangle in {material} at {offset // 3}"
            for index in triangle:
                normal = normals[index]
                dot = sum(geometric[axis] * normal[axis] for axis in range(3))
                assert dot > 1e-12, f"inward winding in {material} at {offset // 3}: dot={dot}"


def make_glb(name, store):
    validate_winding(store)
    binary = bytearray()
    views, accessors, primitives = [], [], []
    materials = []
    material_index = {}
    for key in store:
        rgba, metal, rough = MATERIALS[key]
        material_index[key] = len(materials)
        materials.append({"name": key, "pbrMetallicRoughness": {
            "baseColorFactor": rgba, "metallicFactor": metal, "roughnessFactor": rough}})
    for key, data in store.items():
        attrs = {}
        for semantic, values in (("POSITION", data["positions"]), ("NORMAL", data["normals"])):
            offset = len(binary)
            flat = [number for vector in values for number in vector]
            binary.extend(struct.pack("<" + "f" * len(flat), *flat))
            views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(flat) * 4, "target": 34962})
            vectors = list(zip(*values))
            acc = {"bufferView": len(views) - 1, "componentType": 5126, "count": len(values), "type": "VEC3"}
            if semantic == "POSITION":
                acc.update(min=[min(axis) for axis in vectors], max=[max(axis) for axis in vectors])
            accessors.append(acc)
            attrs[semantic] = len(accessors) - 1
        binary.extend(b"\x00" * ((-len(binary)) % 4))
        offset = len(binary)
        indices = data["indices"]
        binary.extend(struct.pack("<" + "H" * len(indices), *indices))
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(indices) * 2, "target": 34963})
        accessors.append({"bufferView": len(views) - 1, "componentType": 5123,
                          "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]})
        primitives.append({"attributes": attrs, "indices": len(accessors) - 1, "material": material_index[key]})
    binary = align4(bytes(binary))
    doc = {"asset": {"version": "2.0", "generator": "Ryuka deterministic GLB generator"},
           "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}],
           "meshes": [{"name": name, "primitives": primitives}], "materials": materials,
           "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors}
    encoded = align4(json.dumps(doc, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8"), b" ")
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(encoded), b"JSON") + encoded + struct.pack("<I4s", len(binary), b"BIN\x00") + binary


def read_accessor(doc, binary, accessor_index):
    accessor = doc["accessors"][accessor_index]
    view = doc["bufferViews"][accessor["bufferView"]]
    component_format, component_size = {5123: ("H", 2), 5126: ("f", 4)}[accessor["componentType"]]
    width = {"SCALAR": 1, "VEC3": 3}[accessor["type"]]
    element_size = component_size * width
    stride = view.get("byteStride", element_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = []
    for index in range(accessor["count"]):
        value = struct.unpack_from("<" + component_format * width, binary, start + index * stride)
        values.append(value[0] if width == 1 else value)
    return values


def validate_glb(path):
    raw = path.read_bytes()
    magic, version, declared = struct.unpack_from("<4sII", raw)
    assert magic == b"glTF" and version == 2 and declared == len(raw)
    json_len, json_type = struct.unpack_from("<I4s", raw, 12)
    assert json_type == b"JSON"
    doc = json.loads(raw[20:20 + json_len].decode("utf-8"))
    assert doc.get("scenes") and doc.get("meshes")
    bin_header = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<I4s", raw, bin_header)
    assert bin_type == b"BIN\x00"
    binary = raw[bin_header + 8:bin_header + 8 + bin_len]
    for accessor in doc["accessors"]:
        view = doc["bufferViews"][accessor["bufferView"]]
        component = {5123: 2, 5126: 4}[accessor["componentType"]]
        width = {"SCALAR": 1, "VEC3": 3}[accessor["type"]]
        assert view.get("byteOffset", 0) + accessor.get("byteOffset", 0) + accessor["count"] * component * width <= bin_len
    triangle_count = 0
    for material in doc["materials"]:
        assert not material.get("doubleSided", False)
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            positions = read_accessor(doc, binary, primitive["attributes"]["POSITION"])
            normals = read_accessor(doc, binary, primitive["attributes"]["NORMAL"])
            indices = read_accessor(doc, binary, primitive["indices"])
            assert len(indices) % 3 == 0
            for offset in range(0, len(indices), 3):
                triangle = indices[offset:offset + 3]
                a, b, c = (positions[index] for index in triangle)
                ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
                ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
                geometric = (
                    ab[1] * ac[2] - ab[2] * ac[1],
                    ab[2] * ac[0] - ab[0] * ac[2],
                    ab[0] * ac[1] - ab[1] * ac[0]
                )
                assert sum(component * component for component in geometric) > 1e-18
                for index in triangle:
                    assert sum(geometric[axis] * normals[index][axis] for axis in range(3)) > 1e-12
                triangle_count += 1
    assert triangle_count > 0
    assert len(raw) < 150 * 1024
    return hashlib.sha256(raw).hexdigest(), triangle_count


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    builders = {"tool-shed": shed, "garden-bench": bench, "raised-bed-frame": raised_bed}
    hashes = {}
    for name, builder in builders.items():
        for variant in ("high", "low"):
            path = OUT / f"{name}-{variant}.glb"
            path.write_bytes(make_glb(name, builder(variant == "high")))
            hashes[path.name], triangles = validate_glb(path)
            print(f"PASS {path.name}: {path.stat().st_size} bytes, {triangles} outward triangles, {hashes[path.name]}")
    assert sum(path.stat().st_size for path in OUT.glob("*.glb")) < 1024 * 1024


if __name__ == "__main__":
    main()
