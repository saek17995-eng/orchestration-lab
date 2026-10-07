"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupMeta, instruments } from "@/lib/orchestra-data";

type Props = { activeIds: string[]; mutedIds: string[]; selectedId: string; onSelect: (id: string) => void };

export function OrchestraScene({ activeIds, mutedIds, selectedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ meshes: Map<string, THREE.Mesh> } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080b12, 0.035);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 10.5, 14.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x080b12, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 8; controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2.15; controls.target.set(0, 0, -1.2);
    scene.add(new THREE.HemisphereLight(0xb8d9ff, 0x1a1010, 1.2));
    const key = new THREE.DirectionalLight(0xffdfaa, 3.2); key.position.set(-4, 10, 7); scene.add(key);
    const rim = new THREE.PointLight(0x55d6be, 18, 24); rim.position.set(5, 4, -6); scene.add(rim);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(8.7, 80, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x121a27, roughness: .82, metalness: .18 }));
    floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI; floor.position.z = 1.5; scene.add(floor);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(.55, .7, .18, 32), new THREE.MeshStandardMaterial({ color: 0x6b4a24, metalness: .25 }));
    podium.position.set(0, .1, 3.2); scene.add(podium);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(.7, .08, .45), new THREE.MeshStandardMaterial({ color: 0xd8aa5d, metalness: .7 }));
    stand.position.set(0, 1.05, 3); stand.rotation.x = -.35; scene.add(stand);

    const meshes = new Map<string, THREE.Mesh>();
    instruments.forEach((item) => {
      const color = new THREE.Color(groupMeta[item.group].color);
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .08, roughness: .35, metalness: .28, transparent: true });
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(.27, .58, 5, 10), material);
      mesh.position.set(item.position[0], .55, item.position[2]); mesh.userData.id = item.id;
      scene.add(mesh); meshes.set(item.id, mesh);
      const chair = new THREE.Mesh(new THREE.BoxGeometry(.58, .08, .5), new THREE.MeshStandardMaterial({ color: 0x344054, roughness: .75 }));
      chair.position.set(item.position[0], .16, item.position[2] + .4); scene.add(chair);
    });
    stateRef.current = { meshes };

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...meshes.values()])[0];
      if (hit?.object.userData.id) onSelect(hit.object.userData.id);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const compact = width < 720;
      renderer.setSize(width, height, true);
      camera.aspect = width / Math.max(height, 1);
      camera.fov = compact ? 52 : 38;
      camera.position.set(0, compact ? 13.5 : 10.5, compact ? 18 : 14.5);
      controls.target.set(0, 0, -1.2);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const tick = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointer); controls.dispose(); renderer.dispose();
      scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()); } });
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [onSelect]);

  useEffect(() => {
    stateRef.current?.meshes.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const active = activeIds.includes(id), muted = mutedIds.includes(id), selected = selectedId === id;
      material.opacity = muted ? .16 : 1; material.emissiveIntensity = muted ? 0 : active ? 2.2 : selected ? .8 : .08;
      mesh.scale.setScalar(selected ? 1.32 : active ? 1.14 : 1);
    });
  }, [activeIds, mutedIds, selectedId]);

  return <div ref={mountRef} className="absolute inset-0" aria-label="可旋转的三维管弦乐队舞台" />;
}
