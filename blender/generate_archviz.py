#!/usr/bin/env python3
"""Deterministic ROOM/50 ArchViz generator for Blender 5.x.

Run through Blender, not the system Python:

    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python blender/generate_archviz.py -- --variant all

The script deliberately uses only generated meshes, generated image textures, and
Blender's bundled font.  It consumes the canonical pass/fail scene briefs instead
of duplicating furniture coordinates in the visual layer.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import re
import struct
import sys
from pathlib import Path
from typing import Iterable, Sequence

import bpy
import numpy as np
from mathutils import Vector


BLENDER_COLLECTIONS = (
    "00_SHELL",
    "01_ARCHITECTURE",
    "02_SERVICE",
    "03_FURNITURE",
    "04_ACCESSIBILITY",
    "05_LIGHTING",
)

SEMANTIC_GROUP_COLLECTIONS = {
    "shell": "00_SHELL",
    "architecture": "01_ARCHITECTURE",
    "service": "02_SERVICE",
    "furniture": "03_FURNITURE",
    "accessibility": "04_ACCESSIBILITY",
    "lighting": "05_LIGHTING",
}

LEGACY_TAG_COLLECTIONS = {
    "partition": "01_ARCHITECTURE",
    "back-bar": "02_SERVICE",
    "service-counter": "02_SERVICE",
    "lowered-counter": "02_SERVICE",
}

SHELL_LENGTH_M = 10.0
SHELL_WIDTH_M = 5.0
SHELL_HEIGHT_M = 3.2
CONCEPT_LABEL = "CONCEPT DEMO — NOT FOR CONSTRUCTION"


def parse_args() -> argparse.Namespace:
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=("pass", "fail", "all"), default="all")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="ROOM_50 repository root",
    )
    parser.add_argument("--resolution", nargs=2, type=int, default=(1280, 800))
    parser.add_argument("--samples", type=int, default=64)
    parser.add_argument("--texture-size", type=int, default=512)
    parser.add_argument("--skip-render", action="store_true")
    return parser.parse_args(raw)


def slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-")


def hex_rgb(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def contract_to_blender(location: Sequence[float]) -> tuple[float, float, float]:
    """Map ROOM/50 (Three x, z, height) coordinates into Blender x, y, z.

    Blender's glTF Y-up export maps Blender ``(x, y, z)`` to glTF
    ``(x, z, -y)``. Negating the contract's second floor-plane coordinate here
    therefore preserves the fixture value as Three.js ``z`` after export.
    """
    return (float(location[0]), -float(location[1]), float(location[2]))


def mix_rgb(a: Sequence[float], b: Sequence[float], factor: np.ndarray) -> np.ndarray:
    aa = np.asarray(a, dtype=np.float32)[None, None, :]
    bb = np.asarray(b, dtype=np.float32)[None, None, :]
    return aa * (1.0 - factor[..., None]) + bb * factor[..., None]


def periodic_noise(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Small, deterministic, tileable pseudo-noise field."""
    value = (
        np.sin(2 * math.pi * (x * 3.0 + y * 2.0)) * 0.42
        + np.sin(2 * math.pi * (x * 7.0 - y * 5.0)) * 0.23
        + np.cos(2 * math.pi * (x * 13.0 + y * 11.0)) * 0.16
        + np.sin(2 * math.pi * (x * 23.0 - y * 17.0)) * 0.09
    )
    return value / 0.9


def texture_fields(kind: str, size: int) -> tuple[np.ndarray, np.ndarray]:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    x = xx / float(size)
    y = yy / float(size)
    noise = periodic_noise(x, y)

    if kind == "oak":
        grain = 0.5 + 0.5 * np.sin(2 * math.pi * (x * 7.0 + noise * 0.22))
        pores = 0.5 + 0.5 * np.sin(2 * math.pi * (x * 43.0 + y * 2.0 + noise * 0.35))
        field = np.clip(grain * 0.72 + pores * 0.18 + noise * 0.10, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#9B663B"), hex_rgb("#D6AD77"), field)
        height = field * 0.7 + pores * 0.3
    elif kind == "plaster":
        fine = 0.5 + 0.5 * periodic_noise(x * 4.0 % 1.0, y * 4.0 % 1.0)
        field = np.clip(0.52 + noise * 0.08 + fine * 0.07, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#D9CBB9"), hex_rgb("#F5EEE2"), field)
        height = fine * 0.75 + noise * 0.25
    elif kind == "linen":
        warp = 0.5 + 0.5 * np.sin(2 * math.pi * x * 76.0)
        weft = 0.5 + 0.5 * np.sin(2 * math.pi * y * 71.0)
        weave = np.clip(warp * 0.46 + weft * 0.46 + noise * 0.08, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#A94F3B"), hex_rgb("#D98264"), weave * 0.58)
        height = weave
    elif kind == "sage_linen":
        warp = 0.5 + 0.5 * np.sin(2 * math.pi * x * 68.0)
        weft = 0.5 + 0.5 * np.sin(2 * math.pi * y * 73.0)
        weave = np.clip(warp * 0.46 + weft * 0.46 + noise * 0.08, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#596D5B"), hex_rgb("#91A382"), weave * 0.52)
        height = weave
    elif kind == "clay":
        field = np.clip(0.5 + noise * 0.22, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#783A2C"), hex_rgb("#B85B43"), field)
        height = 0.5 + noise * 0.5
    elif kind == "stone":
        base = np.clip(0.56 + noise * 0.09, 0.0, 1.0)
        speckle = (
            (np.sin(2 * math.pi * (x * 41.0 + y * 29.0)) > 0.96)
            | (np.cos(2 * math.pi * (x * 31.0 - y * 37.0)) > 0.965)
        ).astype(np.float32)
        color = mix_rgb(hex_rgb("#C4B5A1"), hex_rgb("#EEE7DB"), base)
        color = color * (1.0 - speckle[..., None] * 0.28)
        height = np.clip(base + speckle * 0.12, 0.0, 1.0)
    elif kind == "terrazzo":
        base = np.clip(0.58 + noise * 0.08, 0.0, 1.0)
        color = mix_rgb(hex_rgb("#B9A58E"), hex_rgb("#E7DAC7"), base)
        chips_a = (np.sin(2 * math.pi * (x * 37 + y * 19)) > 0.975)
        chips_b = (np.cos(2 * math.pi * (x * 23 - y * 43)) > 0.98)
        color[chips_a] = np.asarray(hex_rgb("#8A4A3B"), dtype=np.float32)
        color[chips_b] = np.asarray(hex_rgb("#66715F"), dtype=np.float32)
        height = np.clip(base + chips_a * 0.08 + chips_b * 0.08, 0.0, 1.0)
    else:
        raise ValueError(f"Unknown texture kind: {kind}")

    return np.clip(color, 0.0, 1.0).astype(np.float32), np.clip(height, 0.0, 1.0).astype(np.float32)


def normal_from_height(height: np.ndarray, strength: float = 2.2) -> np.ndarray:
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / length, ny / length, nz / length), axis=-1)
    return (normal * 0.5 + 0.5).astype(np.float32)


def save_image_pixels(path: Path, rgb: np.ndarray, colorspace: str) -> None:
    height, width, _ = rgb.shape
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[..., :3] = rgb
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def write_procedural_textures(texture_dir: Path, size: int) -> None:
    texture_dir.mkdir(parents=True, exist_ok=True)
    for kind in ("oak", "plaster", "linen", "sage_linen", "clay", "stone", "terrazzo"):
        color, height = texture_fields(kind, size)
        save_image_pixels(texture_dir / f"{kind}-basecolor.png", color, "sRGB")
        save_image_pixels(texture_dir / f"{kind}-normal.png", normal_from_height(height), "Non-Color")


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def make_collections() -> dict[str, bpy.types.Collection]:
    collections: dict[str, bpy.types.Collection] = {}
    for name in BLENDER_COLLECTIONS:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
        collections[name] = collection
    return collections


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def assign_material(obj: bpy.types.Object, material: bpy.types.Material | None) -> None:
    if material is not None and hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    if width <= 0.0:
        return
    modifier = obj.modifiers.new("softened-edges", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def add_empty(
    name: str,
    collection: bpy.types.Collection,
    location: Sequence[float] = (0, 0, 0),
    rotation_z: float = 0.0,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.16
    obj.location = contract_to_blender(location)
    obj.rotation_euler[2] = rotation_z
    return obj


def add_box(
    name: str,
    size: Sequence[float],
    location: Sequence[float],
    material: bpy.types.Material | None,
    collection: bpy.types.Collection,
    *,
    rotation: Sequence[float] = (0, 0, 0),
    parent: bpy.types.Object | None = None,
    bevel: float = 0.015,
    blender_space: bool = False,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location if blender_space else contract_to_blender(location)
    obj.rotation_euler = rotation
    assign_material(obj, material)
    add_bevel(obj, min(bevel, min(size) * 0.24))
    return obj


def add_cylinder(
    name: str,
    radius: float,
    depth: float,
    location: Sequence[float],
    material: bpy.types.Material | None,
    collection: bpy.types.Collection,
    *,
    vertices: int = 48,
    rotation: Sequence[float] = (0, 0, 0),
    parent: bpy.types.Object | None = None,
    bevel: float = 0.01,
    blender_space: bool = False,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location if blender_space else contract_to_blender(location)
    obj.rotation_euler = rotation
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    add_bevel(obj, min(bevel, radius * 0.22, depth * 0.22))
    return obj


def add_cone(
    name: str,
    radius1: float,
    radius2: float,
    depth: float,
    location: Sequence[float],
    material: bpy.types.Material | None,
    collection: bpy.types.Collection,
    *,
    parent: bpy.types.Object | None = None,
    rotation: Sequence[float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=48,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=(0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = contract_to_blender(location)
    obj.rotation_euler = rotation
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    add_bevel(obj, 0.008, 2)
    return obj


def add_uv_sphere(
    name: str,
    scale: Sequence[float],
    location: Sequence[float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    *,
    parent: bpy.types.Object | None = None,
    rotation: Sequence[float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = contract_to_blender(location)
    obj.rotation_euler = rotation
    obj.scale = scale
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_torus(
    name: str,
    major_radius: float,
    minor_radius: float,
    location: Sequence[float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    *,
    rotation: Sequence[float] = (0, 0, 0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=(0, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = contract_to_blender(location)
    obj.rotation_euler = rotation
    assign_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_text(
    name: str,
    body: str,
    location: Sequence[float],
    size: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    *,
    rotation: Sequence[float] = (0, 0, 0),
    align_x: str = "CENTER",
    align_y: str = "CENTER",
    extrude: float = 0.006,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}-font", type="FONT")
    curve.body = body
    curve.align_x = align_x
    curve.align_y = align_y
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = min(0.0025, extrude * 0.4)
    curve.bevel_resolution = 2
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.location = contract_to_blender(location)
    obj.rotation_euler = rotation
    assign_material(obj, material)
    return obj


def add_cylinder_between(
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    radius: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    *,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    start_v = Vector(contract_to_blender(start))
    end_v = Vector(contract_to_blender(end))
    midpoint = (start_v + end_v) * 0.5
    delta = end_v - start_v
    obj = add_cylinder(
        name,
        radius,
        delta.length,
        midpoint,
        material,
        collection,
        parent=parent,
        bevel=radius * 0.3,
        blender_space=True,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def principled_material(
    name: str,
    base_color: str,
    *,
    roughness: float = 0.5,
    metallic: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = (*hex_rgb(base_color), 1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = rgba
    return mat


def textured_material(
    name: str,
    kind: str,
    texture_dir: Path,
    representative: str,
    roughness: float,
) -> bpy.types.Material:
    mat = principled_material(name, representative, roughness=roughness)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")

    base = nodes.new("ShaderNodeTexImage")
    base.name = f"{kind}-basecolor"
    base.label = "Generated base color (CC0-equivalent in-repo procedural output)"
    base.image = bpy.data.images.load(str(texture_dir / f"{kind}-basecolor.png"), check_existing=True)
    base.image.colorspace_settings.name = "sRGB"
    links.new(base.outputs["Color"], bsdf.inputs["Base Color"])

    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.name = f"{kind}-normal"
    normal_tex.image = bpy.data.images.load(str(texture_dir / f"{kind}-normal.png"), check_existing=True)
    normal_tex.image.colorspace_settings.name = "Non-Color"
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.34 if kind in ("plaster", "stone") else 0.52
    links.new(normal_tex.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def translucent_material(
    name: str,
    color: str,
    alpha: float,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = principled_material(name, color, roughness=0.24)
    mat.diffuse_color = (*hex_rgb(color), alpha)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1.0)
    bsdf.inputs["Alpha"].default_value = alpha
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(color), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = (*hex_rgb(color), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    elif hasattr(mat, "blend_method"):
        mat.blend_method = "BLEND"
    if hasattr(mat, "use_transparency_overlap"):
        mat.use_transparency_overlap = False
    return mat


def glass_material(name: str) -> bpy.types.Material:
    mat = principled_material(name, "#BFD2D1", roughness=0.08)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.82
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = 0.82
    bsdf.inputs["IOR"].default_value = 1.45
    bsdf.inputs["Alpha"].default_value = 0.42
    mat.diffuse_color = (*hex_rgb("#BFD2D1"), 0.42)
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    return mat


def build_materials(texture_dir: Path) -> dict[str, bpy.types.Material]:
    target_accent = "#D7FF3F"
    return {
        "oak": textured_material("MAT_oak_generated", "oak", texture_dir, "#B6804D", 0.42),
        "plaster": textured_material("MAT_lime_plaster_generated", "plaster", texture_dir, "#E9DFD0", 0.78),
        "linen": textured_material("MAT_terracotta_linen_generated", "linen", texture_dir, "#B95E47", 0.72),
        "sage": textured_material("MAT_sage_linen_generated", "sage_linen", texture_dir, "#6B8067", 0.72),
        "clay": textured_material("MAT_handmade_clay_generated", "clay", texture_dir, "#9A4B38", 0.58),
        "stone": textured_material("MAT_warm_stone_generated", "stone", texture_dir, "#D9CBB8", 0.34),
        "terrazzo": textured_material("MAT_terrazzo_generated", "terrazzo", texture_dir, "#D2C2AB", 0.53),
        "charcoal": principled_material("MAT_powdercoat_charcoal", "#171B1A", roughness=0.31, metallic=0.67),
        "brass": principled_material("MAT_brushed_brass", "#A8783C", roughness=0.25, metallic=0.84),
        "ceramic": principled_material("MAT_warm_ceramic", "#F2EDE4", roughness=0.23),
        "coffee": principled_material("MAT_coffee", "#29130C", roughness=0.19),
        "foliage": principled_material("MAT_deep_foliage", "#263E30", roughness=0.66),
        "foliage_light": principled_material("MAT_sage_foliage", "#71846B", roughness=0.66),
        "glass": glass_material("MAT_window_glass"),
        "dark_glass": translucent_material("MAT_smoked_glass", "#28403F", 0.58),
        "white_text": principled_material("MAT_warm_white_type", "#FFF9EE", roughness=0.42),
        "dark_text": principled_material("MAT_charcoal_type", "#171B1A", roughness=0.44),
        "route": translucent_material("MAT_accessibility_route_target", target_accent, 0.26, 0.30),
        "route_solid": translucent_material("MAT_accessibility_target", target_accent, 0.82, 0.85),
        "shadow": principled_material("MAT_shadow_plinth", "#CBB9A1", roughness=0.92),
    }


def tag_semantic_root(root: bpy.types.Object, item: dict) -> None:
    root["semanticTag"] = item["semanticTag"]
    if "semanticGroup" in item:
        root["semanticGroup"] = item["semanticGroup"]
    root["sourceId"] = item["id"]
    root["sourceFixture"] = "demo/fixtures"
    root["elevationM"] = float(item.get("elevationM", 0.0))
    root["bboxWidthM"] = float(item["bbox"]["w"])
    root["bboxDepthM"] = float(item["bbox"]["d"])
    root["bboxHeightM"] = float(item["bbox"]["h"])
    root["conceptStatus"] = "not-for-construction"


def fixture_collection_name(item: dict) -> str:
    """Resolve the canonical destination, retaining tag inference for old briefs."""
    semantic_group = item.get("semanticGroup")
    if semantic_group in SEMANTIC_GROUP_COLLECTIONS:
        return SEMANTIC_GROUP_COLLECTIONS[semantic_group]
    return LEGACY_TAG_COLLECTIONS.get(item.get("semanticTag"), "03_FURNITURE")


def move_semantic_hierarchy(root: bpy.types.Object, collection: bpy.types.Collection) -> None:
    """Keep each modeled fixture and its detail geometry in its declared group."""
    move_to_collection(root, collection)
    for child in root.children_recursive:
        move_to_collection(child, collection)


def build_shell(collections, mats) -> None:
    shell = collections["00_SHELL"]
    architecture = collections["01_ARCHITECTURE"]

    add_box("SHELL_shadow_stage", (11.6, 6.6, 0.12), (0, 0.10, -0.18), mats["shadow"], shell, bevel=0.05)
    floor = add_box(
        "SHELL_10.00m_x_5.00m_floor",
        (SHELL_LENGTH_M, SHELL_WIDTH_M, 0.14),
        (0, 0, -0.07),
        mats["oak"],
        shell,
        bevel=0.025,
    )
    floor["grossAreaM2"] = 50.0
    floor["worldUnit"] = "1 Blender unit = 1 metre"
    floor["clearHeightM"] = SHELL_HEIGHT_M

    add_box("SHELL_back_wall_10.00m", (10.0, 0.12, 3.2), (0, -2.50, 1.60), mats["plaster"], shell, bevel=0.025)
    add_box("SHELL_left_wall_5.00m", (0.12, 5.0, 3.2), (-5.0, 0, 1.60), mats["plaster"], shell, bevel=0.025)
    add_box("SHELL_back_skirting", (9.88, 0.06, 0.13), (0, -2.415, 0.065), mats["oak"], shell, bevel=0.012)
    add_box("SHELL_left_skirting", (0.06, 4.88, 0.13), (-4.915, 0, 0.065), mats["oak"], shell, bevel=0.012)

    # The front and right are intentionally open as an architectural cutaway. Thin
    # brass rails keep the exact 10 m x 5 m boundary explicit in the review image.
    add_box("SHELL_front_boundary_10.00m", (10.0, 0.028, 0.035), (0, 2.50, 0.025), mats["brass"], shell, bevel=0.008)
    add_box("SHELL_right_boundary_5.00m", (0.028, 5.0, 0.035), (5.0, 0, 0.025), mats["brass"], shell, bevel=0.008)

    # A 0.90 m step-free portal on the open review edge.
    portal_x = -3.55
    add_box("ARCH_entrance_jamb_left", (0.08, 0.10, 2.72), (portal_x - 0.49, 2.45, 1.36), mats["charcoal"], architecture, bevel=0.01)
    add_box("ARCH_entrance_jamb_right", (0.08, 0.10, 2.72), (portal_x + 0.49, 2.45, 1.36), mats["charcoal"], architecture, bevel=0.01)
    add_box("ARCH_entrance_header", (1.06, 0.10, 0.08), (portal_x, 2.45, 2.68), mats["charcoal"], architecture, bevel=0.01)
    door = add_box("ARCH_step-free-door__clear-0.90m", (0.88, 0.025, 2.56), (portal_x - 0.42, 2.45, 1.32), mats["glass"], architecture, bevel=0.008)
    door.rotation_euler[2] = math.radians(-32)
    door["clearWidthTargetM"] = 0.90
    door["stepFree"] = True

    # Tall smoked-glass panels turn the retained wall into a moody café backdrop.
    for idx, y in enumerate((-1.72, -0.56, 0.60, 1.76), 1):
        add_box(f"ARCH_window_{idx:02d}_glass", (0.025, 0.92, 1.84), (-4.925, y, 1.68), mats["dark_glass"], architecture, bevel=0.02)
        add_box(f"ARCH_window_{idx:02d}_sill", (0.055, 1.00, 0.055), (-4.89, y, 0.75), mats["brass"], architecture, bevel=0.01)
        for z in (0.78, 2.60):
            add_box(f"ARCH_window_{idx:02d}_rail_{z:.2f}", (0.055, 1.00, 0.035), (-4.89, y, z), mats["charcoal"], architecture, bevel=0.006)

    add_text(
        "SIGN_room50",
        "ROOM/50",
        (-0.40, -2.415, 2.62),
        0.42,
        mats["dark_text"],
        architecture,
        rotation=(math.radians(90), 0, 0),
        extrude=0.015,
    )
    add_text(
        "SIGN_concept_disclaimer",
        CONCEPT_LABEL,
        (-0.40, -2.408, 2.24),
        0.115,
        mats["dark_text"],
        architecture,
        rotation=(math.radians(90), 0, 0),
        extrude=0.008,
    )


def build_partition(item, root, collections, mats) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    architecture = collections["01_ARCHITECTURE"]
    if w > d:
        # Leave an explicit 0.90 m WC door opening at the right end while retaining
        # a semantic root whose source bbox matches the fixture.
        opening = min(0.90, max(0.0, w - 0.45))
        solid_w = w - opening
        add_box(f"{item['id']}__wall", (solid_w, d, h), (-opening / 2, 0, h / 2), mats["plaster"], architecture, parent=root, bevel=0.018)
        add_box(f"{item['id']}__door-head", (opening, d, 0.42), (solid_w / 2, 0, h - 0.21), mats["plaster"], architecture, parent=root, bevel=0.012)
        add_box(f"{item['id']}__oak-door", (opening - 0.04, 0.045, 2.05), (solid_w / 2 + 0.12, 0.04, 1.025), mats["oak"], architecture, parent=root, rotation=(0, 0, math.radians(-24)), bevel=0.018)
    else:
        add_box(f"{item['id']}__wall", (w, d, h), (0, 0, h / 2), mats["plaster"], architecture, parent=root, bevel=0.018)


def build_toilet(item, root, collections, mats) -> None:
    furniture = collections["03_FURNITURE"]
    architecture = collections["01_ARCHITECTURE"]
    add_cylinder(f"{item['id']}__base", 0.27, 0.36, (0, 0.04, 0.18), mats["ceramic"], furniture, parent=root, bevel=0.025)
    add_uv_sphere(f"{item['id']}__bowl", (0.31, 0.38, 0.16), (0, 0.02, 0.38), mats["ceramic"], furniture, parent=root)
    add_box(f"{item['id']}__cistern", (0.48, 0.16, 0.46), (0, -0.26, 0.57), mats["ceramic"], furniture, parent=root, bevel=0.055)
    add_torus(f"{item['id']}__seat", 0.25, 0.035, (0, 0.07, 0.49), mats["charcoal"], furniture, parent=root)
    # Non-certifying grab-bar concept geometry stays semantic and visible.
    add_cylinder_between(f"{item['id']}__grab-bar", (-0.45, -0.25, 0.82), (0.45, -0.25, 0.82), 0.025, mats["brass"], architecture, parent=root)


def add_cup(name, parent, location, collections, mats, scale=1.0) -> None:
    collection = collections["03_FURNITURE"]
    add_cylinder(f"{name}__cup", 0.045 * scale, 0.075 * scale, location, mats["ceramic"], collection, parent=parent, bevel=0.008)
    add_cylinder(f"{name}__coffee", 0.037 * scale, 0.004, (location[0], location[1], location[2] + 0.038 * scale), mats["coffee"], collection, parent=parent, bevel=0.001)


def add_vase(name, parent, location, collections, mats) -> None:
    collection = collections["03_FURNITURE"]
    add_cone(f"{name}__vase", 0.055, 0.038, 0.14, location, mats["clay"], collection, parent=parent)
    for idx, angle in enumerate((-0.55, 0.0, 0.55)):
        add_cylinder_between(
            f"{name}__stem-{idx+1}",
            (location[0], location[1], location[2] + 0.07),
            (location[0] + math.sin(angle) * 0.10, location[1] + math.cos(angle) * 0.05, location[2] + 0.27),
            0.006,
            mats["foliage"],
            collection,
            parent=parent,
        )
        add_uv_sphere(
            f"{name}__leaf-{idx+1}",
            (0.045, 0.025, 0.085),
            (location[0] + math.sin(angle) * 0.10, location[1] + math.cos(angle) * 0.05, location[2] + 0.29),
            mats["foliage_light"],
            collection,
            parent=parent,
            rotation=(angle, 0, angle),
        )


def build_back_bar(item, root, collections, mats) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    service = collections["02_SERVICE"]
    add_box(f"{item['id']}__carcass", (w, d * 0.90, h - 0.06), (0, 0, (h - 0.06) / 2), mats["oak"], service, parent=root, bevel=0.025)
    add_box(f"{item['id']}__stone-top", (w + 0.04, d + 0.04, 0.065), (0, 0, h - 0.032), mats["stone"], service, parent=root, bevel=0.018)
    for idx in range(6):
        x = -w / 2 + (idx + 0.5) * w / 6
        add_box(f"{item['id']}__door-{idx+1:02d}", (w / 6 - 0.035, 0.025, h * 0.73), (x, d * 0.47, h * 0.47), mats["clay"] if idx % 3 == 1 else mats["oak"], service, parent=root, bevel=0.012)
        add_cylinder(f"{item['id']}__pull-{idx+1:02d}", 0.009, 0.12, (x, d * 0.50, h * 0.62), mats["brass"], service, parent=root, rotation=(math.radians(90), 0, 0), bevel=0.003)

    # Espresso machine, grinder, cups, and high shelf: rich detail stays on worktops.
    add_box(f"{item['id']}__espresso-body", (0.62, 0.33, 0.34), (0.38, 0.0, h + 0.19), mats["charcoal"], service, parent=root, bevel=0.055)
    add_box(f"{item['id']}__espresso-face", (0.54, 0.025, 0.16), (0.38, 0.18, h + 0.22), mats["brass"], service, parent=root, bevel=0.025)
    for idx, x in enumerate((0.20, 0.56), 1):
        add_cylinder(f"{item['id']}__group-head-{idx}", 0.055, 0.075, (x, 0.20, h + 0.20), mats["charcoal"], service, parent=root, rotation=(math.radians(90), 0, 0), bevel=0.008)
    add_cylinder(f"{item['id']}__grinder", 0.11, 0.28, (-0.38, 0.0, h + 0.14), mats["charcoal"], service, parent=root, bevel=0.02)
    add_cone(f"{item['id']}__grinder-hopper", 0.12, 0.08, 0.20, (-0.38, 0.0, h + 0.38), mats["glass"], service, parent=root)
    for idx in range(4):
        add_cup(f"{item['id']}__cup-{idx+1}", root, (-0.93 + idx * 0.12, 0.06, h + 0.075), collections, mats, 0.86)

    add_box(f"{item['id']}__high-shelf", (w * 0.72, 0.28, 0.055), (0.22, -0.07, 1.72), mats["oak"], service, parent=root, bevel=0.012)
    for idx in range(7):
        color_mat = mats["clay"] if idx % 3 == 0 else mats["ceramic"]
        add_cylinder(f"{item['id']}__shelf-jar-{idx+1}", 0.055, 0.16 + (idx % 2) * 0.04, (-1.0 + idx * 0.32, -0.06, 1.83), color_mat, service, parent=root, bevel=0.012)


def build_service_counter(item, root, collections, mats, lowered: bool) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    service = collections["02_SERVICE"]
    add_box(f"{item['id']}__body", (w, d * 0.92, h - 0.06), (0, 0, (h - 0.06) / 2), mats["clay"], service, parent=root, bevel=0.055)
    add_box(f"{item['id']}__worktop", (w + 0.05, d + 0.06, 0.065), (0, 0, h - 0.032), mats["stone"], service, parent=root, bevel=0.022)
    flute_count = max(5, int(w / 0.12))
    for idx in range(flute_count):
        x = -w / 2 + (idx + 0.5) * w / flute_count
        add_box(f"{item['id']}__flute-{idx+1:02d}", (0.024, 0.025, h * 0.76), (x, d * 0.47, h * 0.43), mats["brass"] if idx % 7 == 0 else mats["clay"], service, parent=root, bevel=0.006)
    if lowered:
        root["maximumHeightM"] = 0.76
        add_text(
            f"{item['id']}__height-label",
            "0.76 m",
            (0, d * 0.49 + 0.02, h * 0.62),
            0.13,
            mats["white_text"],
            collections["04_ACCESSIBILITY"],
            rotation=(math.radians(90), 0, 0),
            extrude=0.008,
        )
    else:
        add_text(
            f"{item['id']}__mark",
            "R / 50",
            (0, d * 0.49 + 0.02, h * 0.54),
            0.22,
            mats["white_text"],
            service,
            rotation=(math.radians(90), 0, 0),
            extrude=0.009,
        )
        # Pastry bell and small point-of-sale terminal live above the counter.
        add_cylinder(f"{item['id']}__pastry-board", 0.22, 0.035, (-0.82, 0, h + 0.02), mats["oak"], service, parent=root, bevel=0.008)
        add_uv_sphere(f"{item['id']}__cloche", (0.20, 0.20, 0.15), (-0.82, 0, h + 0.14), mats["glass"], service, parent=root)
        add_box(f"{item['id']}__pos", (0.20, 0.12, 0.26), (0.74, -0.02, h + 0.14), mats["charcoal"], service, parent=root, rotation=(math.radians(-12), 0, 0), bevel=0.035)


def build_table(item, root, collections, mats, round_table: bool, accessible: bool) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    furniture = collections["03_FURNITURE"]
    if round_table:
        add_cylinder(f"{item['id']}__oak-top", min(w, d) * 0.5, 0.055, (0, 0, h - 0.028), mats["oak"], furniture, parent=root, bevel=0.016)
        add_cylinder(f"{item['id']}__pedestal", 0.055, h - 0.09, (0, 0, (h - 0.09) / 2), mats["charcoal"], furniture, parent=root, bevel=0.008)
        add_cylinder(f"{item['id']}__base", min(w, d) * 0.24, 0.035, (0, 0, 0.018), mats["charcoal"], furniture, parent=root, bevel=0.01)
    else:
        add_box(f"{item['id']}__oak-top", (w, d, 0.055), (0, 0, h - 0.028), mats["oak"], furniture, parent=root, bevel=0.035)
        inset = 0.105 if accessible else 0.08
        for idx, (x, y) in enumerate(((-w / 2 + inset, -d / 2 + inset), (w / 2 - inset, -d / 2 + inset), (-w / 2 + inset, d / 2 - inset), (w / 2 - inset, d / 2 - inset)), 1):
            add_cylinder(f"{item['id']}__leg-{idx}", 0.026, h - 0.055, (x, y, (h - 0.055) / 2), mats["charcoal"], furniture, parent=root, bevel=0.005)
    if accessible:
        root["kneeClearHeightM"] = 0.70
        root["wheelchairPosition"] = True
        add_text(
            f"{item['id']}__knee-label",
            "KNEE ≥ 0.70 m",
            (0, -d * 0.44, 0.08),
            0.07,
            mats["route_solid"],
            collections["04_ACCESSIBILITY"],
            rotation=(math.radians(90), 0, 0),
            extrude=0.003,
        )
        add_vase(f"{item['id']}__bud-vase", root, (w * 0.27, d * 0.25, h + 0.07), collections, mats)
    else:
        if sum(ord(char) for char in item["id"]) % 2:
            add_cup(f"{item['id']}__cup", root, (w * 0.16, -d * 0.12, h + 0.04), collections, mats)
        else:
            add_vase(f"{item['id']}__vase", root, (0, 0, h + 0.07), collections, mats)


def build_chair(item, root, collections, mats) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    furniture = collections["03_FURNITURE"]
    seat_z = 0.45
    add_box(f"{item['id']}__seat-frame", (w * 0.90, d * 0.80, 0.065), (0, 0, seat_z), mats["oak"], furniture, parent=root, bevel=0.028)
    add_box(f"{item['id']}__linen-pad", (w * 0.78, d * 0.68, 0.075), (0, -0.005, seat_z + 0.055), mats["sage"] if "bench" in item["id"] else mats["linen"], furniture, parent=root, bevel=0.032)
    inset_x = w * 0.36
    inset_y = d * 0.30
    for idx, (x, y) in enumerate(((-inset_x, -inset_y), (inset_x, -inset_y), (-inset_x, inset_y), (inset_x, inset_y)), 1):
        add_cylinder(f"{item['id']}__leg-{idx}", 0.021, seat_z - 0.02, (x, y, (seat_z - 0.02) / 2), mats["charcoal"], furniture, parent=root, bevel=0.004)
    back_y = d * 0.39
    for idx, x in enumerate((-w * 0.34, w * 0.34), 1):
        add_cylinder(f"{item['id']}__back-post-{idx}", 0.022, h - seat_z, (x, back_y, seat_z + (h - seat_z) / 2), mats["charcoal"], furniture, parent=root, bevel=0.004)
    add_box(f"{item['id']}__curved-back", (w * 0.84, 0.065, 0.24), (0, back_y, h - 0.16), mats["oak"], furniture, parent=root, rotation=(math.radians(-5), 0, 0), bevel=0.045)


def build_bench(item, root, collections, mats) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    furniture = collections["03_FURNITURE"]
    add_box(f"{item['id']}__oak-plinth", (w, d * 0.88, h * 0.66), (0, 0.03, h * 0.33), mats["oak"], furniture, parent=root, bevel=0.04)
    add_box(f"{item['id']}__linen-seat", (w * 0.96, d * 0.84, 0.12), (0, -0.02, h - 0.06), mats["linen"], furniture, parent=root, bevel=0.06)
    add_box(f"{item['id']}__linen-back", (w * 0.96, 0.12, 0.48), (0, d * 0.35, h + 0.20), mats["linen"], furniture, parent=root, rotation=(math.radians(-7), 0, 0), bevel=0.06)
    for idx, x in enumerate((-w * 0.33, 0, w * 0.33), 1):
        add_box(f"{item['id']}__back-channel-{idx}", (0.025, 0.015, 0.36), (x, d * 0.285, h + 0.20), mats["clay"], furniture, parent=root, rotation=(math.radians(-7), 0, 0), bevel=0.006)


def build_plant(item, root, collections, mats) -> None:
    w, d, h = (float(item["bbox"][key]) for key in ("w", "d", "h"))
    furniture = collections["03_FURNITURE"]
    add_cone(f"{item['id']}__terracotta-pot", min(w, d) * 0.33, min(w, d) * 0.25, h * 0.34, (0, 0, h * 0.17), mats["clay"], furniture, parent=root)
    add_cylinder(f"{item['id']}__soil", min(w, d) * 0.245, 0.025, (0, 0, h * 0.335), mats["coffee"], furniture, parent=root, bevel=0.003)
    for idx in range(11):
        angle = idx * (math.tau / 11.0) + 0.25
        radius = 0.10 + (idx % 3) * 0.055
        z = h * (0.50 + (idx % 4) * 0.12)
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius * 0.70
        add_cylinder_between(f"{item['id']}__stem-{idx+1:02d}", (0, 0, h * 0.33), (x, y, z), 0.010, mats["foliage"], furniture, parent=root)
        add_uv_sphere(
            f"{item['id']}__leaf-{idx+1:02d}",
            (0.16, 0.07, 0.055),
            (x, y, z),
            mats["foliage_light"] if idx % 3 == 0 else mats["foliage"],
            furniture,
            parent=root,
            rotation=(angle * 0.22, angle * 0.15, angle),
        )


def build_fixture_objects(brief: dict, collections, mats) -> None:
    for item in brief["objects"]:
        tag = item["semanticTag"]
        collection_name = fixture_collection_name(item)
        x, z = item["position"]
        elevation = float(item.get("elevationM", 0.0))
        root = add_empty(
            f"SEM_{slug(item['id'])}__{slug(tag)}",
            collections[collection_name],
            (float(x), float(z), elevation),
            float(item.get("rotation", 0)),
        )
        tag_semantic_root(root, item)

        if tag == "partition":
            build_partition(item, root, collections, mats)
        elif tag == "toilet":
            build_toilet(item, root, collections, mats)
        elif tag == "back-bar":
            build_back_bar(item, root, collections, mats)
        elif tag == "service-counter":
            build_service_counter(item, root, collections, mats, lowered=False)
        elif tag == "lowered-counter":
            build_service_counter(item, root, collections, mats, lowered=True)
        elif tag == "accessible-table":
            build_table(item, root, collections, mats, round_table=False, accessible=True)
        elif tag == "round-table":
            build_table(item, root, collections, mats, round_table=True, accessible=False)
        elif tag == "table":
            build_table(item, root, collections, mats, round_table=False, accessible=False)
        elif tag == "chair":
            build_chair(item, root, collections, mats)
        elif tag == "bench-seat":
            build_bench(item, root, collections, mats)
        elif tag == "plant":
            build_plant(item, root, collections, mats)
        else:
            bbox = item["bbox"]
            add_box(f"{item['id']}__proxy", (bbox["w"], bbox["d"], bbox["h"]), (0, 0, bbox["h"] / 2), mats["stone"], collections[collection_name], parent=root, bevel=0.025)

        move_semantic_hierarchy(root, collections[collection_name])


def add_route_segment(name, start, end, width, collection, mat) -> None:
    start_v = Vector((start[0], start[1], 0.018))
    end_v = Vector((end[0], end[1], 0.018))
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    add_box(
        name,
        (delta.length + 0.16, width, 0.018),
        midpoint,
        mat,
        collection,
        # A positive Three.js Y rotation turns local +X toward -Z. The negative
        # planar angle aligns this generated strip with contract-space endpoints.
        rotation=(0, 0, -math.atan2(delta.y, delta.x)),
        bevel=0.008,
    )


def derive_seat_capacity(brief: dict) -> int:
    seats = brief.get("seats")
    if not isinstance(seats, list):
        raise ValueError("Canonical scene brief must provide a seats array")
    return sum(1 for seat in seats if seat.get("countsTowardCapacity") is True)


def build_accessibility(
    brief: dict,
    seat_capacity: int,
    collections,
    mats,
) -> None:
    collection = collections["04_ACCESSIBILITY"]
    accessibility = brief["accessibility"]
    route = accessibility["route"]
    route_target_width = float(route["minimumClearWidthM"])
    points = [(float(point[0]), float(point[1])) for point in route["centerline"]]
    if len(points) < 2:
        raise ValueError("Canonical accessibility route requires at least two centerline points")
    for index, (start, end) in enumerate(zip(points, points[1:]), 1):
        add_route_segment(
            f"ACCESS_route-{index:02d}__target-{route_target_width:.2f}m",
            start,
            end,
            route_target_width,
            collection,
            mats["route"],
        )

    zones = [
        (
            str(zone["at"]),
            float(zone["center"][0]),
            float(zone["center"][1]),
            float(zone["diameterM"]),
        )
        for zone in accessibility["turningZones"]
    ]
    for name, x, z, diameter in zones:
        radius = diameter / 2
        safe_name = slug(name)
        disc = add_cylinder(f"ACCESS_turning-zone-{safe_name}__diameter-{diameter:.2f}m", radius, 0.018, (x, z, 0.028), mats["route"], collection, vertices=64, bevel=0.004)
        disc["diameterM"] = diameter
        add_torus(f"ACCESS_turning-ring-{safe_name}", max(radius - 0.025, 0.001), 0.025, (x, z, 0.046), mats["route_solid"], collection)
        add_text(f"ACCESS_label-{safe_name}", f"Ø {diameter:.2f} m", (x, z, 0.06), 0.11, mats["route_solid"], collection, rotation=(0, 0, 0), extrude=0.003)

    b3 = next(item for item in brief["objects"] if item["id"] == "table-b3")
    bx, bz = b3["position"]
    add_torus("ACCESS_B3_decision-ring", 0.59, 0.038, (bx, bz, 0.065), mats["route_solid"], collection)
    add_text(
        "ACCESS_route-width-label",
        f"TARGET {route_target_width:.2f} m",
        (-0.52, -0.62, 0.065),
        0.12,
        mats["route_solid"],
        collection,
        rotation=(0, 0, math.radians(-7)),
        extrude=0.004,
    )

    status = "ACCESSIBILITY TARGETS"
    status_detail = f"ROUTE ≥ {route_target_width:.2f} m  •  {seat_capacity} CAPACITY POSITIONS"
    add_box("ACCESS_status-plaque", (4.55, 0.50, 0.045), (2.45, 2.86, -0.04), mats["dark_text"], collection, bevel=0.035)
    add_text("ACCESS_status-title", status, (2.45, 2.80, 0.015), 0.17, mats["route_solid"], collection, extrude=0.004)
    add_text("ACCESS_status-detail", status_detail, (2.45, 3.01, 0.015), 0.085, mats["white_text"], collection, extrude=0.003)

    stop_stages = [str(stop["stage"]) for stop in route["stops"]]
    collection["toggleable"] = True
    collection["continuousRouteSequence"] = " > ".join(stop_stages)
    collection["targetMinimumClearWidthM"] = route_target_width
    collection["status"] = "demo-target-not-code-certification"


def add_pendant(name, x, y, z, collections, mats) -> None:
    collection = collections["05_LIGHTING"]
    add_cylinder(f"{name}__cord", 0.008, 3.15 - z + 0.20, (x, y, z + (3.15 - z + 0.20) / 2), mats["charcoal"], collection, bevel=0.002)
    add_cone(f"{name}__shade", 0.31, 0.13, 0.25, (x, y, z), mats["clay"], collection)
    add_cylinder(f"{name}__warm-glow", 0.13, 0.025, (x, y, z - 0.13), mats["white_text"], collection, bevel=0.005)
    bpy.ops.object.light_add(type="POINT", location=contract_to_blender((x, y, z - 0.22)))
    light = bpy.context.object
    light.name = f"{name}__2700K"
    move_to_collection(light, collection)
    light.data.energy = 42
    light.data.color = (1.0, 0.55, 0.28)
    light.data.shadow_soft_size = 0.52


def add_area_light(name, location, energy, size, color, collection, target=(0, 0, 0.8)) -> None:
    mapped_location = contract_to_blender(location)
    mapped_target = contract_to_blender(target)
    bpy.ops.object.light_add(type="AREA", location=mapped_location)
    light = bpy.context.object
    light.name = name
    move_to_collection(light, collection)
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = color
    direction = Vector(mapped_target) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_lighting(collections, mats) -> None:
    collection = collections["05_LIGHTING"]
    for idx, (x, y, z) in enumerate(((2.00, -0.85, 2.55), (3.20, -0.85, 2.55), (4.22, 1.30, 2.60), (2.48, 1.50, 2.60)), 1):
        add_pendant(f"LIGHT_pendant-{idx:02d}", x, y, z, collections, mats)

    add_area_light("LIGHT_window-key", (0.2, 5.6, 5.8), 1180, 5.5, (1.0, 0.78, 0.60), collection, target=(0.2, 0.0, 0.7))
    add_area_light("LIGHT_left-window-fill", (-6.0, 0.0, 3.8), 860, 4.2, (0.64, 0.82, 1.0), collection, target=(-1.2, 0.0, 0.8))
    add_area_light("LIGHT_soft-fill", (5.2, 4.3, 6.8), 740, 3.2, (1.0, 0.88, 0.72), collection, target=(0.5, -0.2, 0.6))
    add_area_light("LIGHT_back-rim", (-1.0, -4.0, 4.2), 620, 3.0, (1.0, 0.48, 0.28), collection, target=(0.0, 0.0, 1.0))


def build_wall_details(collections, mats) -> None:
    architecture = collections["01_ARCHITECTURE"]
    furniture = collections["03_FURNITURE"]
    # Menu and tactile identity panels add scale and keep the back wall composed.
    add_box("ARCH_menu-board", (1.05, 0.055, 1.02), (0.78, -2.405, 1.54), mats["charcoal"], architecture, bevel=0.035)
    add_text("ARCH_menu-title", "CAFÉ  /  DAILY", (0.78, -2.365, 1.82), 0.12, mats["white_text"], architecture, rotation=(math.radians(90), 0, 0), extrude=0.004)
    add_text("ARCH_menu-lines", "ESPRESSO   3\nFLAT WHITE  4\nFILTER      4\nPASTRY      5", (0.78, -2.36, 1.48), 0.075, mats["white_text"], architecture, rotation=(math.radians(90), 0, 0), extrude=0.003)

    for idx, (x, z, color) in enumerate(((-1.15, 1.55, "sage"), (-0.22, 1.53, "clay")), 1):
        add_box(f"ARCH_art-{idx:02d}_frame", (0.64, 0.04, 0.82), (x, -2.415, z), mats["oak"], architecture, bevel=0.025)
        add_box(f"ARCH_art-{idx:02d}_print", (0.54, 0.025, 0.72), (x, -2.382, z), mats[color], architecture, bevel=0.015)
        add_cylinder(f"ARCH_art-{idx:02d}_motif", 0.13 + idx * 0.025, 0.018, (x, -2.355, z + 0.05), mats["stone"], architecture, rotation=(math.radians(90), 0, 0), bevel=0.004)

    # A slim ceiling beam grid gives shadows and perceived detail without adding
    # floor obstacles.
    for idx, x in enumerate((-3.1, -1.1, 0.9, 2.9), 1):
        add_box(f"ARCH_ceiling-beam-{idx:02d}", (0.075, 4.84, 0.11), (x, -0.02, 3.08), mats["oak"], architecture, bevel=0.015)

    # Small high-level trailing plants occupy wall/shelf space only.
    for idx, (x, y, z) in enumerate(((-4.82, -1.55, 2.72), (-4.82, 1.32, 2.66)), 1):
        add_cone(f"FURN_high-plant-{idx:02d}_pot", 0.16, 0.12, 0.23, (x, y, z), mats["clay"], furniture)
        for leaf_idx in range(5):
            angle = leaf_idx * 1.18
            add_uv_sphere(
                f"FURN_high-plant-{idx:02d}_leaf-{leaf_idx+1}",
                (0.13, 0.055, 0.045),
                (x + math.cos(angle) * 0.12, y + math.sin(angle) * 0.12, z + 0.16 + (leaf_idx % 2) * 0.07),
                mats["foliage_light"],
                furniture,
                rotation=(0.2, angle * 0.1, angle),
            )


def configure_scene(width: int, height: int, samples: int) -> None:
    scene = bpy.context.scene
    scene.name = "ROOM50_ARCHVIZ"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    # Blender 5.x exposes Eevee Next under the shorter BLENDER_EEVEE id, while
    # Blender 4.x used BLENDER_EEVEE_NEXT.
    engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engine_ids else "BLENDER_EEVEE_NEXT"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = samples
        scene.eevee.taa_samples = min(samples, 32)
        if hasattr(scene.eevee, "use_raytracing"):
            scene.eevee.use_raytracing = False
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True

    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.18
    scene.view_settings.gamma = 1.0

    world = bpy.data.worlds.new("WORLD_warm_gallery") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.055, 0.043, 0.035, 1.0)
    background.inputs["Strength"].default_value = 0.28

    scene["project"] = "ROOM/50"
    scene["conceptLabel"] = CONCEPT_LABEL
    scene["shellDimensionsM"] = "10 x 5 x 3.2"
    scene["grossAreaM2"] = 50.0
    scene["worldUnits"] = "metres"


def add_camera(name: str, location: Sequence[float], target: Sequence[float], ortho_scale: float, collection) -> bpy.types.Object:
    camera_data = bpy.data.cameras.new(name=f"{name}-data")
    camera = bpy.data.objects.new(name, camera_data)
    collection.objects.link(camera)
    camera.location = contract_to_blender(location)
    camera.rotation_euler = (Vector(contract_to_blender(target)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = ortho_scale
    camera_data.lens = 52
    camera_data.dof.use_dof = False
    return camera


def setup_cameras(collections) -> tuple[bpy.types.Object, bpy.types.Object]:
    collection = collections["05_LIGHTING"]
    axon = add_camera("CAM_axonomentric-review", (8.7, 10.6, 8.4), (0.0, -0.05, 0.52), 11.35, collection)
    top = add_camera("CAM_top-evidence", (0, 0, 14.5), (0, 0, 0), 11.35, collection)
    top.rotation_euler[2] = 0.0
    bpy.context.scene.camera = axon
    return axon, top


def render_still(path: Path, file_format: str) -> None:
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    scene.render.image_settings.file_format = file_format
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)


def export_glb(path: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_cameras=True,
        export_lights=True,
        export_extras=True,
        export_yup=True,
    )


def validate_glb_landmarks(path: Path, brief: dict) -> dict[str, list[float]]:
    """Read the exported GLB JSON and prove fixture coordinates survived Y-up export."""
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<III", handle.read(12))
        if magic != 0x46546C67 or version != 2:
            raise ValueError(f"{path} is not a glTF 2.0 binary")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise ValueError(f"{path} first chunk is not JSON")
        document = json.loads(handle.read(chunk_length))

    nodes = {node.get("name"): node for node in document.get("nodes", [])}
    b3 = next(item for item in brief["objects"] if item["id"] == "table-b3")
    accessible_table = next(
        item for item in brief["objects"] if item["id"] == "accessible-table"
    )
    expected = {
        "SHELL_back_wall_10.00m": [0.0, 1.6, -2.5],
        "SEM_accessible-table__accessible-table": [
            float(accessible_table["position"][0]),
            float(accessible_table.get("elevationM", 0.0)),
            float(accessible_table["position"][1]),
        ],
        "SEM_table-b3__round-table": [
            float(b3["position"][0]),
            float(b3.get("elevationM", 0.0)),
            float(b3["position"][1]),
        ],
    }
    actual: dict[str, list[float]] = {}
    for name, wanted in expected.items():
        node = nodes.get(name)
        if not node or "translation" not in node:
            raise ValueError(f"{path} is missing landmark node {name}")
        found = [float(value) for value in node["translation"]]
        if any(abs(got - target) > 1e-4 for got, target in zip(found, wanted)):
            raise ValueError(f"{path} coordinate mismatch for {name}: got {found}, expected {wanted}")
        actual[name] = found
    print(f"ROOM50_COORDINATE_CHECK {path.name} {json.dumps(actual, sort_keys=True)}")
    return actual


def output_paths(asset_dir: Path, variant: str) -> dict[str, Path]:
    stem = asset_dir / f"room50-cafe-{variant}"
    return {
        "blend": stem.with_suffix(".blend"),
        "glb": stem.with_suffix(".glb"),
        "poster_png": stem.with_suffix(".png"),
        "poster_webp": stem.with_suffix(".webp"),
        "top_png": asset_dir / f"room50-cafe-{variant}-top-evidence.png",
        "top_webp": asset_dir / f"room50-cafe-{variant}-top-evidence.webp",
    }


def build_variant(repo_root: Path, variant: str, args: argparse.Namespace, texture_dir: Path) -> dict[str, Path]:
    fixture = repo_root / "demo" / "fixtures" / f"{variant}.scene-brief.json"
    with fixture.open("r", encoding="utf-8") as handle:
        brief = json.load(handle)

    shell = brief["shell"]
    actual = (float(shell["lengthM"]), float(shell["widthM"]), float(shell["clearHeightM"]))
    expected = (SHELL_LENGTH_M, SHELL_WIDTH_M, SHELL_HEIGHT_M)
    if actual != expected:
        raise ValueError(f"{fixture} shell {actual} conflicts with canonical {expected}")

    seat_capacity = derive_seat_capacity(brief)
    random.seed(5050 if variant == "pass" else 5000)
    np.random.seed(5050 if variant == "pass" else 5000)
    reset_scene()
    collections = make_collections()
    mats = build_materials(texture_dir)
    configure_scene(args.resolution[0], args.resolution[1], args.samples)

    build_shell(collections, mats)
    build_fixture_objects(brief, collections, mats)
    build_wall_details(collections, mats)
    build_accessibility(brief, seat_capacity, collections, mats)
    build_lighting(collections, mats)
    axon, top = setup_cameras(collections)

    scene = bpy.context.scene
    scene["variant"] = variant
    scene["sourceBrief"] = str(fixture.relative_to(repo_root))
    scene["derivedSeatCapacity"] = seat_capacity

    asset_dir = repo_root / "assets" / "archviz"
    asset_dir.mkdir(parents=True, exist_ok=True)
    paths = output_paths(asset_dir, variant)

    scene.camera = axon
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["blend"]))
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["blend"]))
    export_glb(paths["glb"])
    validate_glb_landmarks(paths["glb"], brief)

    if not args.skip_render:
        # The hero is a clean architectural visual. Canonical accessibility targets
        # stay in an independently toggleable collection and are never presented as
        # validator results; runtime evidence comes only from validation-report.json.
        collections["04_ACCESSIBILITY"].hide_render = True
        scene.camera = axon
        render_still(paths["poster_png"], "PNG")
        render_still(paths["poster_webp"], "WEBP")

        collections["04_ACCESSIBILITY"].hide_render = False
        scene.camera = top
        render_still(paths["top_png"], "PNG")
        render_still(paths["top_webp"], "WEBP")

    collections["04_ACCESSIBILITY"].hide_render = False
    scene.camera = axon
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["blend"]))
    paths["blend"].with_suffix(".blend1").unlink(missing_ok=True)
    return paths


def write_manifest(repo_root: Path, generated: dict[str, dict[str, Path]], args: argparse.Namespace) -> Path:
    manifest_path = repo_root / "assets" / "archviz" / "manifest.json"
    payload = {
        "schemaVersion": "1.0.0",
        "label": CONCEPT_LABEL.lower(),
        "generator": "blender/generate_archviz.py",
        "blenderVersion": bpy.app.version_string,
        "deterministic": True,
        "units": "metric; 1 Blender unit = 1 metre",
        "shell": {"lengthM": 10, "widthM": 5, "clearHeightM": 3.2, "grossAreaM2": 50},
        "render": {
            "engine": bpy.context.scene.render.engine,
            "resolution": list(args.resolution),
            "samples": args.samples,
            "textureSize": args.texture_size,
        },
        "variants": {},
        "provenance": {
            "geometry": "Procedurally generated by this repository; no external model assets.",
            "materials": "Procedurally generated base-color and normal textures; no external image assets.",
            "font": "Blender bundled Bfont.",
            "fixtureData": "demo/fixtures/{pass,fail}.scene-brief.json",
        },
        "knownLimitations": [
            "Concept visualization only; not code certification or construction documentation.",
            "Procedural props are visually representative and are not fabrication-detail models.",
            "Front and right walls are shown as a deliberate axonometric cutaway; boundary rails retain the exact 10 m x 5 m footprint.",
        ],
    }
    for variant, paths in generated.items():
        fixture = repo_root / "demo" / "fixtures" / f"{variant}.scene-brief.json"
        with fixture.open("r", encoding="utf-8") as handle:
            brief = json.load(handle)
        payload["variants"][variant] = {
            "derivedSeatCapacity": derive_seat_capacity(brief),
            "artifacts": {
                key: {
                    "path": str(path.relative_to(repo_root)),
                    "bytes": path.stat().st_size if path.exists() else None,
                }
                for key, path in paths.items()
            },
            "coordinateLandmarks": validate_glb_landmarks(paths["glb"], brief),
        }
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return manifest_path


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    asset_dir = repo_root / "assets" / "archviz"
    texture_dir = asset_dir / "textures"
    write_procedural_textures(texture_dir, args.texture_size)

    variants = ("pass", "fail") if args.variant == "all" else (args.variant,)
    generated: dict[str, dict[str, Path]] = {}
    for variant in variants:
        print(f"ROOM50: building deterministic {variant} ArchViz scene")
        generated[variant] = build_variant(repo_root, variant, args, texture_dir)

    manifest = write_manifest(repo_root, generated, args)
    for variant, paths in generated.items():
        for kind, path in paths.items():
            if path.exists():
                print(f"ROOM50_ARTIFACT {variant} {kind} {path} {path.stat().st_size} bytes")
    print(f"ROOM50_ARTIFACT manifest {manifest} {manifest.stat().st_size} bytes")


if __name__ == "__main__":
    main()
