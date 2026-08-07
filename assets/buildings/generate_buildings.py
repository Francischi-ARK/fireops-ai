"""FireGuard 3D 场景建筑资产生成器（Blender 4.x / 3.6+）。

在 Blender 中运行本脚本，会在本文件所在目录导出三个 GLB：
  factory.glb    多层厂房（平屋顶 + 女儿墙 + 条形窗带 + 屋面设备）
  office.glb     研发办公楼（裙楼 + 塔楼 + 层间线脚 + 屋顶机房）
  warehouse.glb  仓库（锯齿形屋顶 + 高侧窗 + 卷帘门）

所有模型底面中心位于原点、底面 z=0，前端按地块尺寸统一缩放。
由 MCP 执行时：
  script = "<repo>/assets/buildings/generate_buildings.py"
  ns = {"__file__": script}
  exec(compile(open(script, encoding="utf-8").read(), script, "exec"), ns)
"""

import os
import random

import bpy

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat(name, color, rough=0.8, metal=0.05, emission=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        emission_input.default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


WALL = lambda: mat("wall_panel", (0.62, 0.68, 0.72), rough=0.72, metal=0.18)
WALL_DARK = lambda: mat("wall_dark", (0.38, 0.44, 0.48), rough=0.8, metal=0.1)
ROOF = lambda: mat("roof_slab", (0.20, 0.23, 0.26), rough=0.9)
TRIM = lambda: mat("trim_metal", (0.42, 0.46, 0.49), rough=0.5, metal=0.45)
GLASS = lambda: mat("glass_cool", (0.16, 0.24, 0.30), rough=0.25, metal=0.3,
                    emission=(0.34, 0.55, 0.72), strength=0.85)
LIT = lambda: mat("window_lit", (0.9, 0.7, 0.4), rough=0.4,
                  emission=(1.0, 0.72, 0.38), strength=3.2)
DOOR = lambda: mat("door_shutter", (0.36, 0.38, 0.40), rough=0.6, metal=0.35)


def box(parts, name, loc, dims, material, bevel=0.0, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel > 0:
        mod = o.modifiers.new("edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    parts.append(o)
    return o


def cyl(parts, name, loc, radius, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    parts.append(o)
    return o


def parapet(parts, cx, cz, w, d, z, material, height=1.0, thick=0.32):
    """建筑收边的关键：屋顶女儿墙。"""
    box(parts, "parapet", (cx, cz + d / 2, z + height / 2), (w + thick, thick, height), material)
    box(parts, "parapet", (cx, cz - d / 2, z + height / 2), (w + thick, thick, height), material)
    box(parts, "parapet", (cx + w / 2, cz, z + height / 2), (thick, d + thick, height), material)
    box(parts, "parapet", (cx - w / 2, cz, z + height / 2), (thick, d + thick, height), material)


def window_band(parts, rng, cx, cz, z, length, height, axis, lit_ratio=0.3):
    """连续窗带：玻璃底 + 竖向梃 + 随机亮窗。axis='x' 窗带沿 x 方向。"""
    glass, trim, lit = GLASS(), TRIM(), LIT()
    if axis == "x":
        box(parts, "glass", (cx, cz, z), (length, 0.12, height), glass)
        n = int(length / 3.0)
        for i in range(n + 1):
            x = cx - length / 2 + i * length / max(n, 1)
            box(parts, "mullion", (x, cz, z), (0.16, 0.18, height), trim)
        for i in range(n):
            if rng.random() < lit_ratio:
                x = cx - length / 2 + (i + 0.5) * length / max(n, 1)
                box(parts, "litwin", (x, cz, z), (length / n * 0.72, 0.14, height * 0.8), lit)
    else:
        box(parts, "glass", (cx, cz, z), (0.12, length, height), glass)
        n = int(length / 3.0)
        for i in range(n + 1):
            y = cz - length / 2 + i * length / max(n, 1)
            box(parts, "mullion", (cx, y, z), (0.18, 0.16, height), trim)
        for i in range(n):
            if rng.random() < lit_ratio:
                y = cz - length / 2 + (i + 0.5) * length / max(n, 1)
                box(parts, "litwin", (cx, y, z), (0.14, length / n * 0.72, height * 0.8), lit)


def build_factory():
    rng = random.Random(11)
    parts = []
    wall, roof, trim, door = WALL(), ROOF(), TRIM(), DOOR()
    box(parts, "hall", (0, 0, 6), (36, 20, 12), wall, bevel=0.18)
    box(parts, "roof", (0, 0, 12.25), (37.2, 21.2, 0.5), roof, bevel=0.08)
    parapet(parts, 0, 0, 37.0, 21.0, 12.5, trim, height=1.0)
    for z in (4.2, 8.6):
        window_band(parts, rng, 0, 10.05, z, 34, 2.2, "x", lit_ratio=0.32)
        window_band(parts, rng, 0, -10.05, z, 34, 2.2, "x", lit_ratio=0.22)
        window_band(parts, rng, 18.05, 0, z, 16, 2.2, "y", lit_ratio=0.18)
        window_band(parts, rng, -18.05, 0, z, 16, 2.2, "y", lit_ratio=0.18)
    # 主入口雨棚与门斗（短边 y=-10 一侧）
    box(parts, "canopy", (0, -11.1, 3.4), (7, 2.6, 0.35), trim)
    box(parts, "canopy_col", (-2.8, -12.0, 1.7), (0.32, 0.32, 3.4), trim)
    box(parts, "canopy_col", (2.8, -12.0, 1.7), (0.32, 0.32, 3.4), trim)
    box(parts, "entry", (0, -10.06, 1.5), (4.5, 0.1, 3.0), GLASS())
    # 山墙卷帘门（x=+18 一侧）
    box(parts, "roller", (18.06, -3, 2.3), (0.12, 6, 4.6), door)
    # 屋面：楼梯间、风机、排气管
    box(parts, "bulkhead", (-10, 4, 13.9), (5, 4, 2.8), wall, bevel=0.1)
    box(parts, "ahu", (7, -4, 13.5), (3.2, 2.6, 1.6), trim, bevel=0.06)
    box(parts, "ahu", (12, 3, 13.4), (2.6, 2.2, 1.4), trim, bevel=0.06)
    cyl(parts, "vent", (14.5, -6.5, 13.8), 0.35, 2.4, trim)
    cyl(parts, "vent", (-15, 7.5, 13.6), 0.3, 2.0, trim)
    return parts


def build_office():
    rng = random.Random(23)
    parts = []
    wall, wall_dark, roof, trim, glass = WALL(), WALL_DARK(), ROOF(), TRIM(), GLASS()
    # 裙楼
    box(parts, "podium", (0, 0, 3.5), (26, 18, 7), wall, bevel=0.15)
    box(parts, "podium_roof", (0, 0, 7.2), (26.6, 18.6, 0.4), roof)
    parapet(parts, 0, 0, 26.4, 18.4, 7.4, trim, height=0.8)
    window_band(parts, rng, 0, 9.05, 3.6, 24, 3.0, "x", lit_ratio=0.45)
    window_band(parts, rng, 0, -9.05, 3.6, 24, 3.0, "x", lit_ratio=0.35)
    window_band(parts, rng, 13.05, 0, 3.6, 16, 3.0, "y", lit_ratio=0.3)
    window_band(parts, rng, -13.05, 0, 3.6, 16, 3.0, "y", lit_ratio=0.3)
    # 塔楼：深色幕墙核心 + 层间线脚
    box(parts, "tower", (0, 1, 21), (20, 14, 28), wall_dark, bevel=0.15)
    for i in range(9):
        z = 7 + i * 3.5
        box(parts, "slab", (0, 1, z + 0.25), (20.4, 14.4, 0.5), trim)
        if i < 8:
            zc = z + 1.95
            box(parts, "glass", (0, 8.05, zc), (19.4, 0.14, 2.3), glass)
            box(parts, "glass", (0, -6.05, zc), (19.4, 0.14, 2.3), glass)
            box(parts, "glass", (10.05, 1, zc), (0.14, 13.4, 2.3), glass)
            box(parts, "glass", (-10.05, 1, zc), (0.14, 13.4, 2.3), glass)
            for k in range(8):
                x = -8.5 + k * 2.43
                box(parts, "mullion", (x, 8.08, zc), (0.14, 0.18, 2.3), trim)
                box(parts, "mullion", (x, -6.08, zc), (0.14, 0.18, 2.3), trim)
            for k in range(7):
                if rng.random() < 0.4:
                    x = -8.5 + (k + 0.5) * 2.43
                    box(parts, "litwin", (x, 8.1, zc), (1.7, 0.1, 1.8), LIT())
                if rng.random() < 0.3:
                    x = -8.5 + (k + 0.5) * 2.43
                    box(parts, "litwin", (x, -6.1, zc), (1.7, 0.1, 1.8), LIT())
    parapet(parts, 0, 1, 20.2, 14.2, 35.0, trim, height=1.0)
    # 屋顶机房与设备
    box(parts, "bulkhead", (5, 3, 36.4), (6, 4.5, 2.8), wall, bevel=0.1)
    for j in range(3):
        box(parts, "ac", (-6, -2 + j * 3.2, 35.7), (2.4, 2.0, 1.3), trim, bevel=0.05)
    cyl(parts, "antenna", (-8.5, 6, 38), 0.09, 6.0, trim)
    # 裙楼主入口
    box(parts, "canopy", (0, -10.2, 4.6), (9, 3.2, 0.35), trim)
    box(parts, "canopy_col", (-3.6, -11.3, 2.3), (0.35, 0.35, 4.6), trim)
    box(parts, "canopy_col", (3.6, -11.3, 2.3), (0.35, 0.35, 4.6), trim)
    box(parts, "entry", (0, -9.06, 1.6), (5.5, 0.1, 3.2), glass)
    return parts


def sawtooth_roof(parts, x0, teeth, tooth_w, depth, z_base, rise, roof_mat, glass_mat):
    """锯齿形屋顶：斜坡 + 竖向高侧窗，仓库/车间的天际线特征。"""
    y0, y1 = -depth / 2, depth / 2
    verts, faces, mids = [], [], []
    for i in range(teeth):
        x = x0 + i * tooth_w
        b = len(verts)
        verts += [(x, y0, z_base + rise), (x, y1, z_base + rise),
                  (x + tooth_w, y1, z_base), (x + tooth_w, y0, z_base)]
        faces.append((b, b + 1, b + 2, b + 3))
        mids.append(0)
        g = len(verts)
        verts += [(x, y0, z_base), (x, y1, z_base),
                  (x, y1, z_base + rise), (x, y0, z_base + rise)]
        faces.append((g, g + 1, g + 2, g + 3))
        mids.append(1)
        c = len(verts)
        verts += [(x, y0, z_base), (x, y0, z_base + rise), (x + tooth_w, y0, z_base),
                  (x, y1, z_base), (x, y1, z_base + rise), (x + tooth_w, y1, z_base)]
        faces.append((c, c + 1, c + 2))
        faces.append((c + 3, c + 4, c + 5))
        mids += [0, 0]
    mesh = bpy.data.meshes.new("sawtooth")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(roof_mat)
    mesh.materials.append(glass_mat)
    for poly, mi in zip(mesh.polygons, mids):
        poly.material_index = mi
    obj = bpy.data.objects.new("sawtooth", mesh)
    bpy.context.collection.objects.link(obj)
    parts.append(obj)
    return obj


def build_warehouse():
    rng = random.Random(37)
    parts = []
    wall, trim, door, glass = WALL(), TRIM(), DOOR(), GLASS()
    box(parts, "hall", (0, 0, 3.5), (40, 16, 7), wall, bevel=0.12)
    sawtooth_roof(parts, -20, 5, 8, 16, 7.0, 2.2, ROOF(), glass)
    # 山墙封檐
    box(parts, "gable", (-20.15, 0, 7.3), (0.3, 16.4, 0.7), trim)
    box(parts, "gable", (20.15, 0, 7.15), (0.3, 16.4, 0.4), trim)
    # 装卸面（y=-8）：卷帘门 + 通长雨棚
    for x in (-15, -5, 5, 15):
        box(parts, "roller", (x, -8.06, 2.1), (4.5, 0.12, 4.2), door)
    box(parts, "canopy", (0, -8.7, 4.7), (40, 1.4, 0.25), trim)
    # 背立面高窗
    window_band(parts, rng, 0, 8.06, 5.6, 38, 1.3, "x", lit_ratio=0.25)
    window_band(parts, rng, -20.06, 0, 5.6, 14, 1.3, "y", lit_ratio=0.2)
    box(parts, "entry", (18, -8.06, 1.3), (2.2, 0.1, 2.6), glass)
    return parts


def join_by_material(parts):
    """合并同材质网格：每个 GLB 只剩少量 mesh，前端克隆后 draw call 可控。"""
    groups = {}
    for o in parts:
        key = tuple(m.name for m in o.data.materials)
        groups.setdefault(key, []).append(o)
    merged = []
    for key, group in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in group:
            o.select_set(True)
        for o in group:
            bpy.context.view_layer.objects.active = o
            for mod in list(o.modifiers):
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except RuntimeError:
                    pass
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1:
            bpy.ops.object.join()
        group[0].name = key[0] if len(key) == 1 else "mixed"
        group[0].location = (0, 0, 0)
        merged.append(group[0])
    return merged


def export(parts, name):
    merged = join_by_material(parts)
    bpy.ops.object.select_all(action="DESELECT")
    for o in merged:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, name),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


def main():
    for builder, name in ((build_factory, "factory.glb"),
                          (build_office, "office.glb"),
                          (build_warehouse, "warehouse.glb")):
        clear_scene()
        export(builder(), name)
        print("exported", name)


main()
