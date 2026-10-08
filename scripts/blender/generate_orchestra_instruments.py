"""Generate lightweight Blender orchestra instruments and export web-ready GLB files."""

import math
from pathlib import Path

import bpy
from mathutils import Vector


TEXT_PATH = getattr(getattr(bpy.context.space_data, "text", None), "filepath", "")
SCRIPT_PATH = Path(TEXT_PATH or __file__).resolve()
ROOT = SCRIPT_PATH.parents[2]
OUTPUT = ROOT / "public" / "models" / "instruments"
OUTPUT.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.name != "Collection":
        bpy.data.collections.remove(collection)


def mat(name, color, metallic=0.0, roughness=0.42):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.metallic = metallic
    material.roughness = roughness
    return material


WOOD = mat("Warm maple", (0.52, 0.13, 0.035), 0.05, 0.3)
WOOD_LIGHT = mat("Golden maple", (0.82, 0.34, 0.07), 0.03, 0.28)
EBONY = mat("Ebony", (0.018, 0.024, 0.03), 0.05, 0.28)
GOLD = mat("Polished brass", (0.86, 0.53, 0.08), 0.78, 0.18)
SILVER = mat("Polished silver", (0.72, 0.79, 0.86), 0.9, 0.13)
REDWOOD = mat("Bassoon rosewood", (0.36, 0.035, 0.018), 0.05, 0.3)
SKIN = mat("Drum head", (0.82, 0.76, 0.64), 0.0, 0.72)
COPPER = mat("Timpani copper", (0.55, 0.19, 0.06), 0.65, 0.24)


def link(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def sphere(collection, name, location, scale, material, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    return smooth(link(obj, collection))


def cube(collection, name, location, scale, material, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    link(obj, collection)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def cylinder(collection, name, start, end, radius, material, vertices=16):
    a, b = Vector(start), Vector(end)
    delta = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.data.materials.append(material)
    return smooth(link(obj, collection))


def cone(collection, name, location, radius1, radius2, depth, material, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return smooth(link(obj, collection))


def torus(collection, name, location, major, minor, material, rotation=(0, 0, 0), major_segments=28):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments, minor_segments=8, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return smooth(link(obj, collection))


def new_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def violin(collection, scale=1.0, upright=False):
    # Two maple bouts, waist, fingerboard, bridge, strings, pegs and bow.
    sphere(collection, "Lower bout", (-0.18, 0.0, 0), (0.27, 0.19, 0.085), WOOD_LIGHT)
    sphere(collection, "Upper bout", (0.10, 0.0, 0), (0.21, 0.16, 0.078), WOOD_LIGHT)
    sphere(collection, "Waist", (-0.035, 0, 0), (0.16, 0.115, 0.075), WOOD)
    cube(collection, "Fingerboard", (0.36, 0.0, -0.075), (0.30, 0.035, 0.025), EBONY, rotation=(0, 0, -0.03), bevel=0.015)
    cylinder(collection, "Neck", (0.22, 0, 0), (0.68, 0, 0), 0.034, WOOD, 12)
    sphere(collection, "Scroll", (0.72, 0, 0), (0.075, 0.065, 0.055), WOOD)
    cube(collection, "Bridge", (-0.03, 0, -0.105), (0.022, 0.13, 0.035), SKIN, bevel=0.01)
    for y in (-0.018, -0.006, 0.006, 0.018):
        cylinder(collection, "String", (-0.28, y, -0.115), (0.65, y, -0.115), 0.004, SILVER, 8)
    cylinder(collection, "Bow", (-0.42, -0.27, 0.02), (0.65, -0.27, 0.02), 0.009, WOOD, 8)
    for obj in collection.objects:
        obj.scale *= scale
    if upright:
        for obj in collection.objects:
            obj.rotation_euler.rotate_axis("Z", math.pi / 2)


def cello(collection, bass=False):
    factor = 1.24 if bass else 1.0
    sphere(collection, "Lower bout", (0, -0.20, 0), (0.30 * factor, 0.34 * factor, 0.10), WOOD_LIGHT)
    sphere(collection, "Upper bout", (0, 0.22, 0), (0.24 * factor, 0.27 * factor, 0.095), WOOD_LIGHT)
    sphere(collection, "Waist", (0, 0.02, 0), (0.19 * factor, 0.18 * factor, 0.09), WOOD)
    cylinder(collection, "Neck", (0, 0.37 * factor, 0), (0, 0.92 * factor, 0), 0.045 * factor, WOOD, 12)
    cube(collection, "Fingerboard", (0, 0.46 * factor, -0.09), (0.045 * factor, 0.43 * factor, 0.025), EBONY, bevel=0.015)
    sphere(collection, "Scroll", (0, 0.99 * factor, 0), (0.08 * factor, 0.10 * factor, 0.07), WOOD)
    cube(collection, "Bridge", (0, -0.03, -0.12), (0.16 * factor, 0.024, 0.04), SKIN, bevel=0.012)
    cylinder(collection, "End pin", (0, -0.5 * factor, 0), (0, -0.79 * factor, 0), 0.015, SILVER, 10)
    for x in (-0.018, -0.006, 0.006, 0.018):
        cylinder(collection, "String", (x, -0.38 * factor, -0.13), (x, 0.89 * factor, -0.13), 0.004, SILVER, 8)


def key_tube(collection, length, radius, body_material, vertical=False, bell=False):
    start, end = ((0, -length / 2, 0), (0, length / 2, 0)) if vertical else ((-length / 2, 0, 0), (length / 2, 0, 0))
    cylinder(collection, "Body", start, end, radius, body_material, 16)
    for i in range(7):
        t = -0.34 + i * 0.113
        location = (0, t * length, -radius * 1.08) if vertical else (t * length, 0, -radius * 1.08)
        torus(collection, "Key", location, radius * 1.18, radius * 0.16, SILVER, rotation=(math.pi / 2, 0, 0))
    if bell:
        location = (0, -length / 2 - .08, 0) if vertical else (-length / 2 - .08, 0, 0)
        rotation = (math.pi, 0, 0) if vertical else (0, -math.pi / 2, 0)
        cone(collection, "Bell", location, radius * 2.3, radius * 1.05, .18, body_material, rotation)


def flute(collection):
    key_tube(collection, 1.25, .027, SILVER)
    cylinder(collection, "Head joint", (.54, 0, 0), (.73, 0, 0), .032, SILVER, 16)
    sphere(collection, "Lip plate", (.49, 0, -.035), (.07, .045, .018), SILVER)


def oboe(collection):
    key_tube(collection, 1.06, .034, EBONY, vertical=True, bell=True)
    cylinder(collection, "Reed", (0, .54, 0), (0, .71, 0), .012, SILVER, 10)


def clarinet(collection):
    key_tube(collection, 1.04, .04, EBONY, vertical=True, bell=True)
    cube(collection, "Mouthpiece", (0, .60, 0), (.035, .12, .035), EBONY, bevel=.015)


def bassoon(collection):
    cylinder(collection, "Long joint", (-.07, -.52, 0), (-.07, .52, 0), .055, REDWOOD, 18)
    cylinder(collection, "Wing joint", (.07, -.48, 0), (.07, .40, 0), .043, REDWOOD, 18)
    cylinder(collection, "Boot", (-.07, -.52, 0), (.07, -.48, 0), .065, REDWOOD, 18)
    cylinder(collection, "Bocal", (.07, .40, 0), (.28, .62, 0), .014, SILVER, 10)
    for y in (-.28, -.04, .20, .38):
        torus(collection, "Key", (-.07, y, -.06), .045, .006, SILVER, rotation=(math.pi / 2, 0, 0))


def horn(collection):
    torus(collection, "Main coil", (0, 0, 0), .36, .055, GOLD)
    torus(collection, "Inner coil", (.05, 0, 0), .20, .038, GOLD)
    cone(collection, "Bell", (-.48, .03, 0), .22, .06, .36, GOLD, rotation=(0, -math.pi / 2, 0))
    cylinder(collection, "Lead pipe", (.12, .2, 0), (.46, .34, 0), .025, GOLD, 14)
    for x in (-.08, .02, .12):
        cylinder(collection, "Valve", (x, -.08, 0), (x, .15, 0), .025, GOLD, 12)


def trumpet(collection):
    cylinder(collection, "Main tube", (-.48, 0, 0), (.38, 0, 0), .034, GOLD, 16)
    cone(collection, "Bell", (-.60, 0, 0), .19, .055, .30, GOLD, rotation=(0, -math.pi / 2, 0))
    cylinder(collection, "Mouthpiece", (.38, 0, 0), (.58, 0, 0), .022, SILVER, 12)
    for x in (-.08, .03, .14):
        cylinder(collection, "Valve", (x, -.11, 0), (x, .16, 0), .035, GOLD, 12)


def trombone(collection):
    cylinder(collection, "Upper tube", (-.48, .08, 0), (.55, .08, 0), .027, GOLD, 14)
    cylinder(collection, "Slide tube", (-.40, -.10, 0), (.70, -.10, 0), .021, GOLD, 14)
    torus(collection, "Slide bow", (.70, -.01, 0), .09, .021, GOLD, rotation=(math.pi / 2, 0, 0))
    cone(collection, "Bell", (-.63, .08, 0), .19, .052, .32, GOLD, rotation=(0, -math.pi / 2, 0))


def tuba(collection):
    torus(collection, "Lower coil", (0, -.15, 0), .30, .065, GOLD)
    torus(collection, "Upper coil", (.02, .08, 0), .19, .045, GOLD)
    cylinder(collection, "Bell stem", (.22, .05, 0), (.22, .55, 0), .055, GOLD, 18)
    cone(collection, "Bell", (.22, .73, 0), .27, .075, .38, GOLD)
    for x in (-.10, 0, .10):
        cylinder(collection, "Valve", (x, -.08, -.02), (x, .19, -.02), .03, GOLD, 12)


def timpani(collection):
    sphere(collection, "Copper bowl", (0, -.05, 0), (.42, .34, .42), COPPER)
    cube(collection, "Drum head", (0, .26, 0), (.39, .025, .39), SKIN, bevel=.04)
    torus(collection, "Rim", (0, .29, 0), .40, .025, GOLD, rotation=(math.pi / 2, 0, 0))
    for x in (-.30, .30):
        cylinder(collection, "Leg", (x, -.18, 0), (x, -.48, 0), .025, EBONY, 10)
    cylinder(collection, "Mallet", (-.25, .35, .08), (.20, .58, .08), .012, WOOD, 8)
    sphere(collection, "Mallet head", (.22, .59, .08), (.05, .05, .05), SKIN)


def percussion(collection):
    # Snare, cymbal and triangle grouped as a compact teaching percussion station.
    cylinder(collection, "Snare shell", (-.34, -.08, 0), (-.34, .16, 0), .24, SILVER, 24)
    torus(collection, "Snare rim", (-.34, .18, 0), .24, .018, GOLD, rotation=(math.pi / 2, 0, 0))
    cylinder(collection, "Cymbal stand", (.26, -.34, 0), (.26, .31, 0), .018, SILVER, 12)
    cone(collection, "Cymbal", (.26, .34, 0), .29, .035, .055, GOLD)
    cylinder(collection, "Triangle left", (-.04, -.12, .03), (.26, .38, .03), .012, SILVER, 8)
    cylinder(collection, "Triangle right", (.26, .38, .03), (.52, -.12, .03), .012, SILVER, 8)
    cylinder(collection, "Triangle base", (.52, -.12, .03), (.04, -.12, .03), .012, SILVER, 8)


BUILDERS = {
    "violin1": lambda c: violin(c, .94),
    "violin2": lambda c: violin(c, .90),
    "viola": lambda c: violin(c, 1.05),
    "cello": lambda c: cello(c, False),
    "bass": lambda c: cello(c, True),
    "flute": flute,
    "oboe": oboe,
    "clarinet": clarinet,
    "bassoon": bassoon,
    "horn": horn,
    "trumpet": trumpet,
    "trombone": trombone,
    "tuba": tuba,
    "timpani": timpani,
    "percussion": percussion,
}


for index, (name, builder) in enumerate(BUILDERS.items()):
    collection = new_collection(name)
    builder(collection)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(collection.objects))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    # Arrange collections in the saved Blender source file for easy inspection.
    offset = Vector(((index % 5) * 2.3, -(index // 5) * 2.5, 0))
    for obj in collection.objects:
        obj.location += offset

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "scripts" / "blender" / "orchestra_instruments.blend"))
print(f"Exported {len(BUILDERS)} Blender instrument models to {OUTPUT}")
