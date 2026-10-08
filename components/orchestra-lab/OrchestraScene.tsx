"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { groupMeta, instruments, instrumentVisualMeta } from "@/lib/orchestra-data";

export type BlenderAsset = { url: string; targetId: string; filename: string };
type Props = { activeIds: string[]; mutedIds: string[]; selectedId: string; blenderAsset: BlenderAsset | null; onSelect: (id: string) => void };
type SeatVisual = { meshes: THREE.Mesh[]; halos: THREE.Mesh[]; instrumentMounts: THREE.Group[] };

const counts: Record<string, number> = {
  violin1: 10, violin2: 8, viola: 6, cello: 6, bass: 4,
  flute: 2, oboe: 2, clarinet: 2, bassoon: 2,
  horn: 4, trumpet: 2, trombone: 3, tuba: 1, timpani: 2, percussion: 3,
};

function arcSeats(radius: number, start: number, end: number, count: number, centerZ = 4) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? .5 : index / (count - 1), angle = start + (end - start) * t;
    return new THREE.Vector3(radius * Math.cos(angle), .12, centerZ - radius * Math.sin(angle));
  });
}

function material(color: THREE.ColorRepresentation, roughness = .58, metalness = .05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: .02 });
}

function addMesh(group: THREE.Group, geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}

function sectionLabel(text: string, color: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, 512, 128); ctx.fillStyle = "rgba(7,12,22,.78)"; ctx.roundRect(8, 12, 496, 104, 30); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = "#f8fafc"; ctx.font = "600 44px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 66);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })); sprite.scale.set(2.8, .7, 1); return sprite;
}

function addInstrumentModel(group: THREE.Group, id: string, color: THREE.Color, playerIndex: number) {
  const meshes: THREE.Mesh[] = [];
  const dark = material(0x25180f, .45, .2), gold = material(0xd9a83c, .24, .76), silver = material(0xdbe5ee, .18, .85), wood = material(0x9a4f28, .38, .08), ebony = material(0x15171b, .34, .22);
  const put = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
    const mesh = addMesh(group, geometry, mat, position, rotation, scale); meshes.push(mesh); return mesh;
  };
  if (["violin1", "violin2", "viola"].includes(id)) {
    const scale = id === "viola" ? .88 : .75;
    put(new THREE.SphereGeometry(.13, 12, 10), wood, [.09, .91, -.03], [.15, 0, -.28], [scale * 1.18, scale, .43]);
    put(new THREE.SphereGeometry(.12, 12, 10), wood, [.22, .91, -.03], [.15, 0, -.28], [scale, scale * .88, .4]);
    put(new THREE.CylinderGeometry(.018, .028, .48, 8), dark, [.34, .96, -.03], [0, 0, Math.PI / 2 - .28], [scale, scale, scale]);
    put(new THREE.BoxGeometry(.34, .022, .045), ebony, [.22, .95, -.075], [0, 0, -.28]);
    put(new THREE.BoxGeometry(.018, .14, .055), material(0xe0bd7c, .52), [.08, .92, -.08], [0, 0, -.28]);
    put(new THREE.CylinderGeometry(.008, .008, .74, 6), material(color, .3, .28), [-.05, .87, .08], [0, 0, .9]);
  } else if (id === "cello" || id === "bass") {
    const scale = id === "bass" ? 1.38 : 1.05, y = id === "bass" ? .7 : .62;
    put(new THREE.SphereGeometry(.18, 14, 12), wood, [.08, y, -.08], [0, 0, -.08], [scale, scale * 1.35, .5]);
    put(new THREE.SphereGeometry(.14, 12, 10), wood, [.08, y + .18 * scale, -.08], [0, 0, -.08], [scale, scale, .48]);
    put(new THREE.CylinderGeometry(.025, .035, .55 * scale, 8), dark, [.08, y + .45 * scale, -.08], [0, 0, -.08]);
    put(new THREE.BoxGeometry(.07, .58 * scale, .035), ebony, [.08, y + .34 * scale, -.17], [0, 0, -.08]);
    put(new THREE.BoxGeometry(.16 * scale, .025, .075), material(0xe0bd7c, .52), [.08, y + .04, -.18]);
    put(new THREE.CylinderGeometry(.008, .008, .68, 6), silver, [.08, y - .42, -.08]);
    put(new THREE.CylinderGeometry(.009, .009, .85 * scale, 6), material(color, .3, .28), [-.16, y + .1, .05], [0, 0, .36]);
  } else if (id === "flute") {
    put(new THREE.CylinderGeometry(.018, .018, .72, 10), silver, [.02, .94, -.03], [0, 0, Math.PI / 2]);
    [-.2, -.05, .1, .25].forEach((x) => put(new THREE.TorusGeometry(.026, .006, 5, 10), silver, [x, .94, -.03], [0, Math.PI / 2, 0]));
  } else if (id === "oboe") {
    put(new THREE.CylinderGeometry(.018, .035, .66, 10), ebony, [.04, .84, -.02], [0, 0, -.25]);
    put(new THREE.ConeGeometry(.065, .13, 14), ebony, [.12, .53, -.02], [0, 0, Math.PI]);
    put(new THREE.CylinderGeometry(.007, .007, .12, 6), silver, [-.04, 1.18, -.02], [0, 0, -.25]);
  } else if (id === "clarinet") {
    put(new THREE.CylinderGeometry(.022, .04, .68, 12), ebony, [.04, .84, -.02], [0, 0, -.2]);
    [-.18, -.04, .1, .24].forEach((y) => put(new THREE.TorusGeometry(.034, .005, 5, 12), silver, [.04 - y * .2, .84 + y, -.02], [Math.PI / 2, 0, 0]));
    put(new THREE.ConeGeometry(.075, .15, 14), ebony, [.11, .5, -.02], [0, 0, Math.PI]);
  } else if (id === "bassoon") {
    put(new THREE.CylinderGeometry(.035, .05, .9, 12), wood, [.1, .72, -.03], [0, 0, -.18]);
    put(new THREE.CylinderGeometry(.012, .012, .3, 8), silver, [-.02, 1.25, -.03], [0, 0, .45]);
    put(new THREE.TorusGeometry(.06, .012, 6, 16, Math.PI), silver, [-.08, 1.37, -.03], [0, 0, .2]);
  } else if (id === "horn") {
    put(new THREE.TorusGeometry(.2, .035, 9, 22), gold, [.02, .88, -.02], [Math.PI / 2, 0, 0]);
    put(new THREE.TorusGeometry(.11, .022, 8, 18), gold, [.02, .88, -.02], [Math.PI / 2, 0, 0]);
    put(new THREE.ConeGeometry(.15, .26, 18, 1, true), gold, [-.27, .86, -.02], [0, 0, -Math.PI / 2]);
  } else if (id === "trumpet") {
    put(new THREE.CylinderGeometry(.027, .04, .66, 12), gold, [.02, .92, -.02], [0, 0, Math.PI / 2]);
    put(new THREE.ConeGeometry(.13, .28, 18, 1, true), gold, [-.43, .92, -.02], [0, 0, -Math.PI / 2]);
    [-.08, .02, .12].forEach((x) => put(new THREE.CylinderGeometry(.018, .018, .16, 8), gold, [x, 1.02, -.02]));
  } else if (id === "trombone") {
    put(new THREE.CylinderGeometry(.022, .03, .82, 10), gold, [.02, .94, -.08], [0, 0, Math.PI / 2]);
    put(new THREE.CylinderGeometry(.014, .014, .78, 8), gold, [.02, .82, .08], [0, 0, Math.PI / 2]);
    put(new THREE.TorusGeometry(.06, .014, 6, 14, Math.PI), gold, [.42, .88, 0], [Math.PI / 2, 0, 0]);
    put(new THREE.ConeGeometry(.15, .3, 18, 1, true), gold, [-.51, .94, -.08], [0, 0, -Math.PI / 2]);
  } else if (id === "tuba") {
    put(new THREE.TorusGeometry(.25, .05, 10, 24), gold, [.02, .75, -.02], [Math.PI / 2, 0, 0]);
    put(new THREE.CylinderGeometry(.04, .055, .55, 12), gold, [.19, 1.02, -.02], [0, 0, -.12]);
    put(new THREE.ConeGeometry(.22, .34, 20, 1, true), gold, [.22, 1.4, -.02]);
  } else if (id === "timpani") {
    put(new THREE.CylinderGeometry(.24, .31, .34, 24), material(0xb56b36, .3, .5), [0, .48, -.05]);
    put(new THREE.CylinderGeometry(.255, .255, .025, 24), material(0xead9b4, .72), [0, .66, -.05]);
    put(new THREE.TorusGeometry(.26, .018, 6, 24), gold, [0, .67, -.05], [Math.PI / 2, 0, 0]);
    [-.18, .18].forEach((x) => put(new THREE.CylinderGeometry(.012, .012, .48, 7), wood, [x, .94, .03], [0, 0, x < 0 ? -.45 : .45]));
  } else if (id === "percussion" && playerIndex % 3 === 0) {
    put(new THREE.CylinderGeometry(.31, .31, .18, 24), material(0x8f3d32, .42, .16), [0, .72, -.08], [0, 0, Math.PI / 2]);
    put(new THREE.CylinderGeometry(.315, .315, .025, 24), material(0xe8d9bd, .7), [-.105, .72, -.08], [0, 0, Math.PI / 2]);
    put(new THREE.TorusGeometry(.315, .018, 6, 24), gold, [-.12, .72, -.08], [0, Math.PI / 2, 0]);
    put(new THREE.CylinderGeometry(.018, .018, .62, 8), dark, [-.16, .38, -.08], [0, 0, -.48]);
    put(new THREE.CylinderGeometry(.018, .018, .62, 8), dark, [.16, .38, -.08], [0, 0, .48]);
  } else if (id === "percussion" && playerIndex % 3 === 1) {
    put(new THREE.CylinderGeometry(.22, .22, .13, 24), material(0xd5d8dc, .3, .65), [0, .72, -.06]);
    put(new THREE.CylinderGeometry(.225, .225, .018, 24), material(0xf3ead5, .72), [0, .795, -.06]);
    put(new THREE.TorusGeometry(.22, .012, 6, 24), silver, [0, .79, -.06], [Math.PI / 2, 0, 0]);
    [-.15, .15].forEach((x) => put(new THREE.CylinderGeometry(.009, .009, .48, 7), wood, [x, 1.02, .03], [0, 0, x < 0 ? -.55 : .55]));
  } else if (id === "percussion") {
    put(new THREE.CylinderGeometry(.2, .16, .025, 24), gold, [-.15, .89, -.03], [.2, 0, -.18]);
    put(new THREE.CylinderGeometry(.2, .16, .025, 24), gold, [.15, .89, -.03], [-.2, 0, .18]);
    put(new THREE.SphereGeometry(.035, 10, 8), gold, [-.15, .9, -.03]);
    put(new THREE.SphereGeometry(.035, 10, 8), gold, [.15, .9, -.03]);
  }
  return meshes;
}

function addMusician(scene: THREE.Scene, id: string, position: THREE.Vector3, color: THREE.Color, index: number) {
  const root = new THREE.Group(); root.position.copy(position); root.rotation.y = Math.atan2(position.x, position.z - 4); root.userData.id = id; scene.add(root);
  const skin = material(index % 3 === 0 ? 0xe7b58f : index % 3 === 1 ? 0xc88764 : 0x8c5b45, .82), cloth = material(color.clone().multiplyScalar(.68), .72), black = material(0x18202d, .78);
  const meshes: THREE.Mesh[] = [];
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.18, .43, 4, 10), cloth, [0, .74, 0]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.145, 14, 12), skin, [0, 1.18, 0]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.151, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(index % 2 ? 0x34251f : 0x1f2937, .9), [0, 1.215, 0]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.018, 8, 6), black, [-.05, 1.2, -.135]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.018, 8, 6), black, [.05, 1.2, -.135]));
  meshes.push(addMesh(root, new THREE.ConeGeometry(.018, .055, 8), skin, [0, 1.16, -.15], [Math.PI / 2, 0, 0]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.045, .32, 3, 7), skin, [-.19, .79, -.08], [0, 0, -.55]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.045, .32, 3, 7), skin, [.19, .79, -.08], [0, 0, .55]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.055, .33, 3, 7), black, [-.1, .31, .08], [0, 0, -.18]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.055, .33, 3, 7), black, [.1, .31, .08], [0, 0, .18]));
  addMesh(root, new THREE.BoxGeometry(.47, .06, .43), material(0x4a3740, .8), [0, .36, .28]);
  addMesh(root, new THREE.BoxGeometry(.47, .5, .055), material(0x3a2e35, .8), [0, .6, .47]);
  addMesh(root, new THREE.CylinderGeometry(.018, .018, .7, 6), black, [0, .5, -.55]);
  addMesh(root, new THREE.BoxGeometry(.47, .035, .35), material(0x273344, .55, .1), [0, .83, -.57], [-.45, 0, 0]);
  const instrumentMount = new THREE.Group();
  instrumentMount.position.z = -.2;
  root.add(instrumentMount);
  meshes.push(...addInstrumentModel(instrumentMount, id, color, index));
  const haloMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .05, transparent: true, opacity: .09, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(.57, 32), haloMaterial); halo.rotation.x = -Math.PI / 2; halo.position.set(position.x, .025, position.z); halo.scale.set(1.25, 1, 1); halo.userData.id = id; scene.add(halo);
  for (const mesh of meshes) { mesh.userData.id = id; mesh.userData.baseScale = mesh.scale.clone(); }
  return { root, meshes, halo, instrumentMount };
}

export function OrchestraScene({ activeIds, mutedIds, selectedId, blenderAsset, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ visuals: Map<string, SeatVisual>; clickables: THREE.Object3D[]; pulses: Map<string, number> } | null>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    let disposed = false;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x07101c, .022);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100); camera.position.set(0, 13.5, 18.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor(0x07101c, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 10; controls.maxDistance = 29; controls.maxPolarAngle = Math.PI / 2.08; controls.target.set(0, .3, -1.5);
    scene.add(new THREE.HemisphereLight(0xb9d9ff, 0x28180f, 1.6));
    const key = new THREE.DirectionalLight(0xffe0b5, 4.3); key.position.set(-6, 13, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12; scene.add(key);
    const rim = new THREE.PointLight(0x56d6c2, 28, 30); rim.position.set(7, 6, -8); scene.add(rim);

    const stage = new THREE.Mesh(new THREE.CircleGeometry(10, 96, 0, Math.PI), material(0x111b29, .72, .12)); stage.rotation.x = -Math.PI / 2; stage.rotation.z = Math.PI; stage.position.set(0, -.12, 4); stage.receiveShadow = true; scene.add(stage);
    const tiers = [
      { inner: .7, outer: 4.55, color: 0x31265b, y: -.02 }, { inner: 4.65, outer: 6.2, color: 0x205b54, y: .015 },
      { inner: 6.3, outer: 7.85, color: 0x76501e, y: .05 }, { inner: 7.95, outer: 9.55, color: 0x6e3036, y: .085 },
    ];
    tiers.forEach((tier) => { const panel = new THREE.Mesh(new THREE.RingGeometry(tier.inner, tier.outer, 80, 1, 0, Math.PI), new THREE.MeshStandardMaterial({ color: tier.color, roughness: .66, metalness: .08, emissive: tier.color, emissiveIntensity: .05 })); panel.rotation.x = -Math.PI / 2; panel.position.set(0, tier.y, 4); panel.receiveShadow = true; scene.add(panel); });
    [4.6, 6.25, 7.9].forEach((radius) => { const edge = new THREE.Mesh(new THREE.TorusGeometry(radius, .035, 6, 100, Math.PI), material(0xb98b4c, .3, .6)); edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI; edge.position.set(0, .12, 4); scene.add(edge); });

    const layouts: Record<string, THREE.Vector3[]> = {
      violin1: [...arcSeats(2.12, 1.78, 2.98, 5), ...arcSeats(3.3, 1.9, 2.98, 5)],
      violin2: [...arcSeats(2.2, .16, 1.34, 4), ...arcSeats(3.34, .22, 1.3, 4)],
      viola: arcSeats(3.92, 1.14, 1.9, 6), cello: arcSeats(3.98, .42, 1.14, 6), bass: arcSeats(4.42, .08, .46, 4),
      flute: arcSeats(5.15, 1.65, 1.9, 2), oboe: arcSeats(5.2, 1.28, 1.52, 2), clarinet: arcSeats(5.65, 1.67, 1.93, 2), bassoon: arcSeats(5.68, 1.18, 1.45, 2),
      horn: arcSeats(6.85, 1.78, 2.35, 4), trumpet: arcSeats(6.85, 1.24, 1.5, 2), trombone: arcSeats(7.2, .65, 1.05, 3), tuba: arcSeats(7.35, .38, .38, 1),
      timpani: arcSeats(8.65, 1.82, 2.12, 2), percussion: arcSeats(8.7, .75, 1.38, 3),
    };
    const visuals = new Map<string, SeatVisual>(), clickables: THREE.Object3D[] = [];
    instruments.forEach((item) => {
      const color = new THREE.Color(instrumentVisualMeta[item.id]?.color ?? groupMeta[item.group].color), visual: SeatVisual = { meshes: [], halos: [], instrumentMounts: [] };
      (layouts[item.id] ?? arcSeats(5, 1.4, 1.7, counts[item.id] ?? 1)).forEach((position, index) => {
        const person = addMusician(scene, item.id, position, color, index); visual.meshes.push(...person.meshes); visual.halos.push(person.halo); visual.instrumentMounts.push(person.instrumentMount); clickables.push(...person.meshes, person.halo);
      });
      visuals.set(item.id, visual);
    });

    const loader = new GLTFLoader();
    const installBlenderModel = (targetId: string, url: string, label: string) => {
      const target = visuals.get(targetId); if (!target) return;
      loader.load(url, ({ scene: imported }) => {
        if (disposed) return;
        const targetSize = targetId === "bass" ? 1.28 : ["cello", "tuba", "timpani"].includes(targetId) ? 1.02 : targetId === "percussion" ? .92 : .74;
        target.instrumentMounts.forEach((mount) => {
          mount.clear();
          const model = imported.clone(true);
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = targetSize / Math.max(size.x, size.y, size.z, .001);
          model.scale.setScalar(scale);
          model.position.set(-center.x * scale, .86 - center.y * scale, -center.z * scale);
          mount.add(model);
          model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.castShadow = true;
            object.receiveShadow = true;
            object.userData.id = targetId;
            object.userData.baseScale = object.scale.clone();
            target.meshes.push(object);
            clickables.push(object);
          });
        });
      }, undefined, (error) => console.warn(`Blender模型 ${label} 加载失败，已保留内置回退模型`, error));
    };
    instruments.forEach((item) => installBlenderModel(item.id, blenderAsset?.targetId === item.id ? blenderAsset.url : `./models/instruments/${item.id}.glb`, blenderAsset?.targetId === item.id ? blenderAsset.filename : item.id));

    const stringLabels = [
      { text: "第一小提琴 · 10", color: instrumentVisualMeta.violin1.color, p: [-3.25, .32, 2.65] },
      { text: "第二小提琴 · 8", color: instrumentVisualMeta.violin2.color, p: [3.05, .32, 2.6] },
      { text: "中提琴 · 6", color: instrumentVisualMeta.viola.color, p: [-1.65, .32, .55] },
      { text: "大提琴 · 6", color: instrumentVisualMeta.cello.color, p: [1.65, .32, .55] },
      { text: "低音提琴 · 4", color: instrumentVisualMeta.bass.color, p: [4.5, .32, .35] },
    ];
    stringLabels.forEach((label) => { const sprite = sectionLabel(label.text, label.color); sprite.scale.set(1.7, .43, 1); sprite.position.set(...label.p as [number, number, number]); scene.add(sprite); });

    [{ text: "弦乐组", color: groupMeta.strings.color, p: [0, .38, .55] }, { text: "木管组", color: groupMeta.woodwinds.color, p: [0, .38, -1.5] }, { text: "铜管组", color: groupMeta.brass.color, p: [0, .38, -3.35] }, { text: "打击乐组", color: groupMeta.percussion.color, p: [0, .38, -5.1] }].forEach((label) => { const sprite = sectionLabel(label.text, label.color); sprite.position.set(label.p[0], label.p[1], label.p[2]); scene.add(sprite); });

    const podium = addMesh(scene as unknown as THREE.Group, new THREE.CylinderGeometry(.64, .78, .2, 32), material(0x8a5b2c, .42, .2), [0, .1, 3.5]);
    const conductor = new THREE.Group(); conductor.position.set(0, .2, 3.42); scene.add(conductor); addMesh(conductor, new THREE.CapsuleGeometry(.2, .58, 5, 10), material(0x293a67, .64), [0, .82, 0]); addMesh(conductor, new THREE.SphereGeometry(.15, 14, 12), material(0xd3a07f, .8), [0, 1.3, 0]); addMesh(conductor, new THREE.CapsuleGeometry(.045, .52, 3, 8), material(0xd3a07f, .8), [-.28, 1.03, -.05], [0, 0, -1.05]); addMesh(conductor, new THREE.CapsuleGeometry(.045, .52, 3, 8), material(0xd3a07f, .8), [.28, 1.03, -.05], [0, 0, 1.05]); addMesh(conductor, new THREE.CylinderGeometry(.009, .009, .8, 6), material(0xf2e8d5, .3), [.56, 1.32, -.03], [0, 0, .9]);
    podium.userData.id = "conductor";
    stateRef.current = { visuals, clickables, pulses: new Map() };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(clickables, false)[0]; if (hit?.object.userData.id) onSelect(hit.object.userData.id); };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    const resize = () => { const width = mount.clientWidth, height = mount.clientHeight, compact = width < 720; renderer.setSize(width, height, true); camera.aspect = width / Math.max(height, 1); camera.fov = compact ? 47 : 40; camera.position.set(0, compact ? 13.8 : 12.5, compact ? 18.2 : 17.2); controls.target.set(0, .35, -1.65); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const tick = (time: number) => { controls.update(); stateRef.current?.pulses.forEach((intensity, id) => { const pulse = intensity * (1.75 + Math.sin(time * .008) * .4); stateRef.current?.visuals.get(id)?.halos.forEach((halo) => { (halo.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse; }); }); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick(0);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointer); controls.dispose(); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => item.dispose()); } }); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [blenderAsset, onSelect]);

  useEffect(() => {
    const state = stateRef.current; if (!state) return; state.pulses.clear();
    state.visuals.forEach((visual, id) => {
      const active = activeIds.includes(id), muted = mutedIds.includes(id), selected = selectedId === id;
      visual.meshes.forEach((mesh) => { const mat = mesh.material as THREE.MeshStandardMaterial; mat.opacity = muted ? .22 : 1; mat.transparent = muted; mat.emissiveIntensity = muted ? 0 : active ? 1.35 : selected ? .38 : .02; const baseScale = mesh.userData.baseScale as THREE.Vector3 | undefined; if (baseScale) mesh.scale.copy(baseScale).multiplyScalar(selected ? 1.04 : active ? 1.025 : 1); });
      visual.halos.forEach((halo) => { const mat = halo.material as THREE.MeshStandardMaterial; mat.opacity = muted ? .015 : active ? .72 : selected ? .25 : .09; mat.emissiveIntensity = muted ? 0 : active ? 2 : selected ? .7 : .05; });
      if (active && !muted) state.pulses.set(id, 1);
    });
  }, [activeIds, mutedIds, selectedId]);

  return <div ref={mountRef} className="absolute inset-0" aria-label="可旋转的写实三维交响乐队舞台，发声声部区域实时发光" />;
}
