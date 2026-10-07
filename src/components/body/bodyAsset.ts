import { Box3, BufferAttribute, BufferGeometry, Matrix3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildAdjacency, classifyMesh, type Adjacency } from './bodyRig';

/** Displayed figure height in scene units (the camera is framed for this). */
export const BODY_HEIGHT = 1.8;

export interface BodyAsset {
  index: BufferAttribute;
  position: BufferAttribute;
  normal: BufferAttribute;
  /** Muscle id per vertex (MUSCLES index + 1; 0 = neutral) as a float attribute for the shader. */
  muscle: BufferAttribute;
  ids: Uint8Array;
  adjacency: Adjacency;
  vertexCount: number;
}

let pending: Promise<BodyAsset> | null = null;

/**
 * Loads, normalises and segments the body model once per session; every body
 * map shares the result (geometry attributes are shared, heat is per view).
 */
export function loadBodyAsset(): Promise<BodyAsset> {
  pending ??= load().catch((err) => {
    pending = null; // allow a retry on the next mount
    throw err;
  });
  return pending;
}

async function load(): Promise<BodyAsset> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/human_body.glb`);
  gltf.scene.updateMatrixWorld(true);
  let source: Mesh | undefined;
  gltf.scene.traverse((o) => {
    if (!source && (o as Mesh).isMesh) source = o as Mesh;
  });
  if (!source) throw new Error('Body model has no mesh');

  const geo = source.geometry;
  const srcPos = geo.getAttribute('position');
  const srcNorm = geo.getAttribute('normal');
  const count = srcPos.count;
  const world = source.matrixWorld;
  const normalMatrix = new Matrix3().getNormalMatrix(world);

  // De-quantise into world space (normalised attributes are read via getX/fromBufferAttribute).
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const v = new Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(srcPos, i).applyMatrix4(world);
    pos.set([v.x, v.y, v.z], i * 3);
    v.fromBufferAttribute(srcNorm, i).applyMatrix3(normalMatrix).normalize();
    nor.set([v.x, v.y, v.z], i * 3);
  }

  // Normalise: height 1, feet at y = 0 (x/z keep the model's own centre).
  const box = new Box3().setFromArray(pos);
  const height = box.max.y - box.min.y;
  for (let i = 0; i < count; i++) {
    pos[i * 3] /= height;
    pos[i * 3 + 1] = (pos[i * 3 + 1] - box.min.y) / height;
    pos[i * 3 + 2] /= height;
  }

  const ids = classifyMesh(pos, nor);
  const indexArray = geo.index ? Array.from(geo.index.array) : Array.from({ length: count }, (_, i) => i);
  const adjacency = buildAdjacency(indexArray, count);

  // Scale to display size after classification (the rig works in normalised units).
  for (let i = 0; i < pos.length; i++) pos[i] *= BODY_HEIGHT;

  geo.dispose();
  return {
    index: new BufferAttribute(count < 65536 ? new Uint16Array(indexArray) : new Uint32Array(indexArray), 1),
    position: new BufferAttribute(pos, 3),
    normal: new BufferAttribute(nor, 3),
    muscle: new BufferAttribute(Float32Array.from(ids), 1),
    ids,
    adjacency,
    vertexCount: count,
  };
}

/** A per-view geometry sharing the asset's attributes, with its own heat buffer. */
export function createBodyGeometry(asset: BodyAsset): { geometry: BufferGeometry; heat: BufferAttribute } {
  const geometry = new BufferGeometry();
  geometry.setIndex(asset.index);
  geometry.setAttribute('position', asset.position);
  geometry.setAttribute('normal', asset.normal);
  geometry.setAttribute('muscle', asset.muscle);
  const heat = new BufferAttribute(new Float32Array(asset.vertexCount), 1);
  geometry.setAttribute('heat', heat);
  geometry.computeBoundingSphere();
  return { geometry, heat };
}
