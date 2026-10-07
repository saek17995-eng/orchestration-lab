"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupMeta, instruments } from "@/lib/orchestra-data";

type Props = { activeIds: string[]; mutedIds: string[]; selectedId: string; onSelect: (id: string) => void };
type SeatVisual = { meshes: THREE.Mesh[]; halos: THREE.Mesh[] };

const counts: Record<string, number> = {
  violin1: 8, violin2: 6, viola: 5, cello: 5, bass: 3,
  flute: 2, oboe: 2, clarinet: 2, bassoon: 2,
  horn: 4, trumpet: 3, trombone: 3, tuba: 1, timpani: 2, percussion: 3,
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

function addInstrumentModel(group: THREE.Group, id: string, color: THREE.Color) {
  const dark = material(0x25180f, .45, .2), gold = material(0xd6a33f, .28, .68), wood = material(0x9a4f28, .38, .08);
  if (["violin1", "violin2", "viola", "cello", "bass"].includes(id)) {
    const scale = id === "bass" ? 1.55 : id === "cello" ? 1.2 : .72;
    addMesh(group, new THREE.SphereGeometry(.15, 12, 10), wood, [.15, .76, .05], [0, 0, -.2], [scale, scale * 1.35, .42]);
    addMesh(group, new THREE.CylinderGeometry(.025, .035, .46, 8), dark, [.15, 1.02, .03], [0, 0, -.2], [scale, scale, scale]);
    addMesh(group, new THREE.CylinderGeometry(.009, .009, .72, 6), material(color, .35, .25), [-.05, .86, .06], [0, 0, .8]);
  } else if (["horn", "trumpet", "trombone", "tuba"].includes(id)) {
    const length = id === "trombone" ? .78 : .52;
    addMesh(group, new THREE.CylinderGeometry(.035, .055, length, 10), gold, [.03, .86, .04], [0, 0, Math.PI / 2]);
    addMesh(group, new THREE.ConeGeometry(id === "tuba" ? .19 : .12, .25, 16, 1, true), gold, [-length / 2, .86, .04], [0, 0, -Math.PI / 2]);
    if (id === "horn") addMesh(group, new THREE.TorusGeometry(.17, .035, 8, 18), gold, [.04, .87, .02], [Math.PI / 2, 0, 0]);
  } else if (["timpani", "percussion"].includes(id)) {
    addMesh(group, new THREE.CylinderGeometry(.22, .29, .36, 20), id === "timpani" ? gold : wood, [0, .48, -.05]);
    addMesh(group, new THREE.CylinderGeometry(.24, .24, .025, 20), material(0xead9b4, .65), [0, .68, -.05]);
  } else {
    const length = id === "bassoon" ? .72 : .56;
    addMesh(group, new THREE.CylinderGeometry(.022, .032, length, 10), id === "flute" ? material(0xd9e0e8, .2, .8) : wood, [.03, .86, .04], [0, 0, Math.PI / 2]);
    addMesh(group, new THREE.SphereGeometry(.05, 10, 8), gold, [-length / 2, .86, .04]);
  }
}

function addMusician(scene: THREE.Scene, id: string, position: THREE.Vector3, color: THREE.Color, index: number) {
  const root = new THREE.Group(); root.position.copy(position); root.rotation.y = Math.atan2(-position.x, 4 - position.z); root.userData.id = id; scene.add(root);
  const skin = material(index % 3 === 0 ? 0xe7b58f : index % 3 === 1 ? 0xc88764 : 0x8c5b45, .82), cloth = material(color.clone().multiplyScalar(.68), .72), black = material(0x18202d, .78);
  const meshes: THREE.Mesh[] = [];
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.18, .43, 4, 10), cloth, [0, .74, 0]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.145, 14, 12), skin, [0, 1.18, 0]));
  meshes.push(addMesh(root, new THREE.SphereGeometry(.151, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(index % 2 ? 0x34251f : 0x1f2937, .9), [0, 1.215, 0]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.045, .32, 3, 7), skin, [-.19, .79, .03], [0, 0, -.55]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.045, .32, 3, 7), skin, [.19, .79, .03], [0, 0, .55]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.055, .33, 3, 7), black, [-.1, .31, .08], [0, 0, -.18]));
  meshes.push(addMesh(root, new THREE.CapsuleGeometry(.055, .33, 3, 7), black, [.1, .31, .08], [0, 0, .18]));
  addMesh(root, new THREE.BoxGeometry(.47, .06, .43), material(0x4a3740, .8), [0, .36, .28]);
  addMesh(root, new THREE.BoxGeometry(.47, .5, .055), material(0x3a2e35, .8), [0, .6, .47]);
  addMesh(root, new THREE.CylinderGeometry(.018, .018, .7, 6), black, [0, .5, -.55]);
  addMesh(root, new THREE.BoxGeometry(.47, .035, .35), material(0x273344, .55, .1), [0, .83, -.57], [-.45, 0, 0]);
  addInstrumentModel(root, id, color);
  const haloMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .05, transparent: true, opacity: .09, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(.57, 32), haloMaterial); halo.rotation.x = -Math.PI / 2; halo.position.set(position.x, .025, position.z); halo.scale.set(1.25, 1, 1); halo.userData.id = id; scene.add(halo);
  for (const mesh of meshes) mesh.userData.id = id;
  return { root, meshes, halo };
}

export function OrchestraScene({ activeIds, mutedIds, selectedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ visuals: Map<string, SeatVisual>; clickables: THREE.Object3D[]; pulses: Map<string, number> } | null>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x07101c, .022);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100); camera.position.set(0, 13.5, 18.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setClearColor(0x07101c, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 10; controls.maxDistance = 29; controls.maxPolarAngle = Math.PI / 2.08; controls.target.set(0, .3, -1.5);
    scene.add(new THREE.HemisphereLight(0xb9d9ff, 0x28180f, 1.6));
    const key = new THREE.DirectionalLight(0xffe0b5, 4.3); key.position.set(-6, 13, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12; scene.add(key);
    const rim = new THREE.PointLight(0x56d6c2, 28, 30); rim.position.set(7, 6, -8); scene.add(rim);

    const stage = new THREE.Mesh(new THREE.CircleGeometry(10, 96, 0, Math.PI), material(0x111b29, .72, .12)); stage.rotation.x = -Math.PI / 2; stage.rotation.z = Math.PI; stage.position.set(0, -.12, 4); stage.receiveShadow = true; scene.add(stage);
    const tiers = [
      { inner: .7, outer: 4.55, color: 0x253467, y: -.02 }, { inner: 4.65, outer: 6.2, color: 0x205b54, y: .015 },
      { inner: 6.3, outer: 7.85, color: 0x76501e, y: .05 }, { inner: 7.95, outer: 9.55, color: 0x6e3036, y: .085 },
    ];
    tiers.forEach((tier) => { const panel = new THREE.Mesh(new THREE.RingGeometry(tier.inner, tier.outer, 80, 1, 0, Math.PI), new THREE.MeshStandardMaterial({ color: tier.color, roughness: .66, metalness: .08, emissive: tier.color, emissiveIntensity: .05 })); panel.rotation.x = -Math.PI / 2; panel.position.set(0, tier.y, 4); panel.receiveShadow = true; scene.add(panel); });
    [4.6, 6.25, 7.9].forEach((radius) => { const edge = new THREE.Mesh(new THREE.TorusGeometry(radius, .035, 6, 100, Math.PI), material(0xb98b4c, .3, .6)); edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI; edge.position.set(0, .12, 4); scene.add(edge); });

    const layouts: Record<string, THREE.Vector3[]> = {
      violin1: [...arcSeats(2.2, 1.78, 2.92, 4), ...arcSeats(3.35, 1.9, 2.93, 4)],
      violin2: [...arcSeats(2.25, .22, 1.34, 3), ...arcSeats(3.38, .28, 1.3, 3)],
      viola: arcSeats(3.95, 1.16, 1.9, 5), cello: arcSeats(3.98, .45, 1.15, 5), bass: arcSeats(4.35, .12, .43, 3),
      flute: arcSeats(5.15, 1.65, 1.9, 2), oboe: arcSeats(5.2, 1.28, 1.52, 2), clarinet: arcSeats(5.65, 1.67, 1.93, 2), bassoon: arcSeats(5.68, 1.18, 1.45, 2),
      horn: arcSeats(6.85, 1.78, 2.35, 4), trumpet: arcSeats(6.85, 1.2, 1.55, 3), trombone: arcSeats(7.2, .65, 1.05, 3), tuba: arcSeats(7.35, .38, .38, 1),
      timpani: arcSeats(8.65, 1.82, 2.12, 2), percussion: arcSeats(8.7, .75, 1.38, 3),
    };
    const visuals = new Map<string, SeatVisual>(), clickables: THREE.Object3D[] = [];
    instruments.forEach((item) => {
      const color = new THREE.Color(groupMeta[item.group].color), visual: SeatVisual = { meshes: [], halos: [] };
      (layouts[item.id] ?? arcSeats(5, 1.4, 1.7, counts[item.id] ?? 1)).forEach((position, index) => {
        const person = addMusician(scene, item.id, position, color, index); visual.meshes.push(...person.meshes); visual.halos.push(person.halo); clickables.push(...person.meshes, person.halo);
      });
      visuals.set(item.id, visual);
    });

    [{ text: "弦乐组", color: groupMeta.strings.color, p: [0, .38, .55] }, { text: "木管组", color: groupMeta.woodwinds.color, p: [0, .38, -1.5] }, { text: "铜管组", color: groupMeta.brass.color, p: [0, .38, -3.35] }, { text: "打击乐组", color: groupMeta.percussion.color, p: [0, .38, -5.1] }].forEach((label) => { const sprite = sectionLabel(label.text, label.color); sprite.position.set(label.p[0], label.p[1], label.p[2]); scene.add(sprite); });

    const podium = addMesh(scene as unknown as THREE.Group, new THREE.CylinderGeometry(.64, .78, .2, 32), material(0x8a5b2c, .42, .2), [0, .1, 3.5]);
    const conductor = new THREE.Group(); conductor.position.set(0, .2, 3.42); scene.add(conductor); addMesh(conductor, new THREE.CapsuleGeometry(.2, .58, 5, 10), material(0x293a67, .64), [0, .82, 0]); addMesh(conductor, new THREE.SphereGeometry(.15, 14, 12), material(0xd3a07f, .8), [0, 1.3, 0]); addMesh(conductor, new THREE.CapsuleGeometry(.045, .52, 3, 8), material(0xd3a07f, .8), [-.28, 1.03, -.05], [0, 0, -1.05]); addMesh(conductor, new THREE.CapsuleGeometry(.045, .52, 3, 8), material(0xd3a07f, .8), [.28, 1.03, -.05], [0, 0, 1.05]); addMesh(conductor, new THREE.CylinderGeometry(.009, .009, .8, 6), material(0xf2e8d5, .3), [.56, 1.32, -.03], [0, 0, .9]);
    podium.userData.id = "conductor";
    stateRef.current = { visuals, clickables, pulses: new Map() };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(clickables, false)[0]; if (hit?.object.userData.id) onSelect(hit.object.userData.id); };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    const resize = () => { const width = mount.clientWidth, height = mount.clientHeight, compact = width < 720; renderer.setSize(width, height, true); camera.aspect = width / Math.max(height, 1); camera.fov = compact ? 54 : 40; camera.position.set(0, compact ? 17 : 13.5, compact ? 23 : 18.5); controls.target.set(0, .3, -1.5); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const tick = (time: number) => { controls.update(); stateRef.current?.pulses.forEach((intensity, id) => { const pulse = intensity * (1.75 + Math.sin(time * .008) * .4); stateRef.current?.visuals.get(id)?.halos.forEach((halo) => { (halo.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse; }); }); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick(0);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointer); controls.dispose(); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => item.dispose()); } }); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [onSelect]);

  useEffect(() => {
    const state = stateRef.current; if (!state) return; state.pulses.clear();
    state.visuals.forEach((visual, id) => {
      const active = activeIds.includes(id), muted = mutedIds.includes(id), selected = selectedId === id;
      visual.meshes.forEach((mesh) => { const mat = mesh.material as THREE.MeshStandardMaterial; mat.opacity = muted ? .22 : 1; mat.transparent = muted; mat.emissiveIntensity = muted ? 0 : active ? 1.35 : selected ? .38 : .02; mesh.scale.setScalar(selected ? 1.04 : active ? 1.025 : 1); });
      visual.halos.forEach((halo) => { const mat = halo.material as THREE.MeshStandardMaterial; mat.opacity = muted ? .015 : active ? .72 : selected ? .25 : .09; mat.emissiveIntensity = muted ? 0 : active ? 2 : selected ? .7 : .05; });
      if (active && !muted) state.pulses.set(id, 1);
    });
  }, [activeIds, mutedIds, selectedId]);

  return <div ref={mountRef} className="absolute inset-0" aria-label="可旋转的写实三维交响乐队舞台，发声声部区域实时发光" />;
}
