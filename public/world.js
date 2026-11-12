// Mundo novo Shinobi Wilds: usa somente o GLB ORIGINAL de Konoha.
// O mapa em blocos de /mundo não é mais renderizado nem usado como fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { WORLD } from './shared.js';

export const ORIGINAL_KONOHA_URL = '/assets/Mundo_Shinobi.glb';

// Carrega o arquivo que o usuário aprovou, sem substituir nem misturar a montanha.
export async function buildNarutoWorld(scene, terrain) {
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(ORIGINAL_KONOHA_URL);
  } catch (err) {
    throw new Error('Konoha original 3D ainda não foi enviada para public/assets/Mundo_Shinobi.glb: ' + (err?.message || err));
  }
  const root = gltf.scene;
  root.name = 'Konoha original — Mundo_Shinobi.glb';
  scene.add(root);
  root.updateMatrixWorld(true);

  const floorMeshes = [];
  const floorName = /terreno|relevo|ruas|caminhos|funda[cç][oõ]es|alicerce|piso|gabinete|sapata|mar_e_rios/i;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Evita consultar toda a malha do mundo a cada movimento do jogador.
    let p = o;
    while (p && p !== root) {
      if (floorName.test(p.name || '')) { floorMeshes.push(o); break; }
      p = p.parent;
    }
    if (o.material) {
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });

  const ray = new THREE.Raycaster();
  ray.far = 300;
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const heights = new Map();
  if (terrain?.setGroundResolver) {
    terrain.setGroundResolver((x, z, aroundY = 0) => {
      // Altura consultada sobre os pisos e o relevo REAIS, não sobre os voxels.
      const key = `${Math.round(x * 4)}:${Math.round(z * 4)}:${Math.round(aroundY * 0.5)}`;
      if (heights.has(key)) return heights.get(key);
      origin.set(x, aroundY + 2.4, z);
      ray.set(origin, down);
      const hits = ray.intersectObjects(floorMeshes, false);
      const h = hits.find(hit => hit.face && hit.face.normal && hit.face.normal.y > 0.3)?.point.y;
      const value = Number.isFinite(h) ? h : aroundY;
      if (heights.size > 4000) heights.clear();
      heights.set(key, value);
      return value;
    });
  }

  // O local EXATO deve ser validado visualmente: o marcador original está DENTRO
  // da sala, e o usuário quer nascer no corredor logo fora da porta do gabinete.
  const marker = root.getObjectByName('Spawn_Sala_do_Hokage');
  let proposedSpawn = new THREE.Vector3(...WORLD.spawn);
  if (marker?.parent) {
    marker.parent.updateWorldMatrix(true, false);
    proposedSpawn = marker.parent.localToWorld(new THREE.Vector3(0, -0.95, 12));
  }
  return {
    root, model: root, proposedSpawn,
    interactables: [], // antigas interações em blocos desativadas até serem posicionadas no GLB
    update() {},
  };
}
