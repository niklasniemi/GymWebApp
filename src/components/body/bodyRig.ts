import { MUSCLES, type Muscle } from '../../data/anatomy';

/*
 * Muscle segmentation for the single-mesh body model.
 *
 * The model ships as one surface, so muscle regions are derived per vertex
 * from an approximate rig measured off the mesh. Coordinates are normalised:
 * height = 1, feet at y = 0, body centred on x = 0, facing +z, arms in an
 * A-pose. Landmarks were taken from cross-section analysis of the model
 * (see scripts/optimize-model.mjs for the asset pipeline):
 *
 *   arm axis (shoulder → fingertips), right side: direction (0.844, −0.537),
 *   measured from (0.340, 0.614); along that axis t = −0.30 shoulder joint,
 *   −0.235 end of deltoid, −0.165 elbow, −0.015 wrist, +0.09 fingertip.
 *   Crotch 0.425 · knee 0.29 · ankle 0.075 · waist 0.53–0.645 ·
 *   ribcage 0.645–0.70 · chest 0.70–0.80 · neck base 0.87.
 *
 * Sides use the surface normal: θ = 0° faces front, +90° faces outward,
 * −90° faces the midline, ±180° faces back.
 */

const ARM_DIR_X = 0.844;
const ARM_DIR_Y = -0.537;
const ARM_ORIGIN_X = 0.34;
const ARM_ORIGIN_Y = 0.614;
const ARM_Z = -0.033;

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Classifies one vertex (normalised position + unit normal). */
export function classifyVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): Muscle | null {
  const side = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  // Angle around the vertical axis: 0 = front, +90 = outward, ±180 = back.
  const theta = deg(Math.atan2(nx * side, nz));
  const at = Math.abs(theta);

  if (y > 0.87) return null; // head & neck

  // ---- Arms (A-pose): project onto the arm axis ---------------------------
  const dx = ax - ARM_ORIGIN_X;
  const dy = y - ARM_ORIGIN_Y;
  const t = dx * ARM_DIR_X + dy * ARM_DIR_Y;
  const radial = Math.hypot(dx * -ARM_DIR_Y + dy * ARM_DIR_X, z - ARM_Z);
  if (y < 0.8 && t > -0.235 && t < 0.12 && radial < 0.06) {
    if (t >= -0.015) return null; // hand
    if (t >= -0.165) return 'forearms';
    // Palms face back in this pose, so the biceps faces forward.
    return z >= ARM_Z ? 'biceps' : 'triceps';
  }

  // ---- Deltoid cap ----------------------------------------------------------
  if (ax > 0.105 && y > 0.715 && y < 0.83) return nz > -0.2 ? 'shoulders' : 'rearDelts';

  // ---- Legs -------------------------------------------------------------------
  if (y < 0.075) return null; // feet & ankles
  if (y < 0.285) return at > 100 ? 'calves' : null;
  if (y < 0.31) return at > 120 ? 'hamstrings' : null; // knee
  if (y < 0.425) {
    if (at > 125) return 'hamstrings';
    if (theta < -40) return 'adductors';
    return 'quads';
  }

  // ---- Pelvis ---------------------------------------------------------------
  if (y < 0.53) {
    if (at > 115) return 'glutes';
    if (y < 0.47 && theta > -60) return 'quads';
    return null;
  }

  // ---- Waist ----------------------------------------------------------------
  if (y < 0.645) {
    if (at > 110) return 'lowerBack';
    return ax < 0.048 && at < 45 ? 'abs' : 'obliques';
  }

  // ---- Lower ribcage ----------------------------------------------------------
  if (y < 0.7) {
    if (at > 75) return 'lats';
    return ax < 0.048 && at < 40 ? 'abs' : 'obliques';
  }

  // ---- Chest band -------------------------------------------------------------
  if (y < 0.8) {
    if (at > 80) return y > 0.775 && ax < 0.08 ? 'traps' : 'lats';
    return 'chest';
  }

  // ---- Shoulder girdle / neck base ------------------------------------------
  if (at > 95 || ny > 0.55) return ax < 0.13 ? 'traps' : null;
  if (y < 0.815 && ax < 0.1) return 'chest';
  return null;
}

/** Muscle id per vertex: index into MUSCLES + 1, or 0 for skin/neutral. */
export function classifyMesh(positions: Float32Array, normals: Float32Array): Uint8Array {
  const count = positions.length / 3;
  const ids = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const m = classifyVertex(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
      normals[i * 3],
      normals[i * 3 + 1],
      normals[i * 3 + 2],
    );
    ids[i] = m ? MUSCLES.indexOf(m) + 1 : 0;
  }
  return ids;
}

export interface Adjacency {
  offsets: Uint32Array;
  neighbors: Uint32Array;
}

/** Vertex adjacency (CSR) from a triangle index buffer — used to blur heat. */
export function buildAdjacency(index: ArrayLike<number>, vertexCount: number): Adjacency {
  const sets: Set<number>[] = Array.from({ length: vertexCount }, () => new Set<number>());
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i];
    const b = index[i + 1];
    const c = index[i + 2];
    sets[a].add(b).add(c);
    sets[b].add(a).add(c);
    sets[c].add(a).add(b);
  }
  const offsets = new Uint32Array(vertexCount + 1);
  for (let v = 0; v < vertexCount; v++) offsets[v + 1] = offsets[v] + sets[v].size;
  const neighbors = new Uint32Array(offsets[vertexCount]);
  for (let v = 0; v < vertexCount; v++) {
    let k = offsets[v];
    for (const n of sets[v]) neighbors[k++] = n;
  }
  return { offsets, neighbors };
}

/**
 * Per-vertex heat from per-muscle heat, softened by a few neighbour-averaging
 * passes so region borders glow into each other like a real heat map.
 */
export function vertexHeat(
  ids: Uint8Array,
  heatByMuscle: ArrayLike<number>,
  adjacency: Adjacency,
  out: Float32Array,
  passes = 3,
): Float32Array {
  const count = ids.length;
  for (let i = 0; i < count; i++) out[i] = ids[i] ? heatByMuscle[ids[i] - 1] : 0;
  let src: Float32Array<ArrayBufferLike> = out;
  let dst: Float32Array<ArrayBufferLike> = new Float32Array(count);
  for (let p = 0; p < passes; p++) {
    for (let v = 0; v < count; v++) {
      const from = adjacency.offsets[v];
      const to = adjacency.offsets[v + 1];
      let s = src[v] * 2;
      for (let k = from; k < to; k++) s += src[adjacency.neighbors[k]];
      dst[v] = s / (to - from + 2);
    }
    [src, dst] = [dst, src];
  }
  if (src !== out) out.set(src);
  return out;
}
