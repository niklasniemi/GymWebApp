/**
 * Optimises the body-map model for the web:
 *   node scripts/optimize-model.mjs <input.glb> [output.glb]
 *
 * - drops UVs (the app shades procedurally, no textures)
 * - welds duplicate vertices (smooth heat gradients across UV seams)
 * - quantises positions/normals (KHR_mesh_quantization, decoded natively by three.js)
 * - 16-bit indices
 * - keeps the CC-BY-4.0 attribution in the asset metadata
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';

const [, , input, output = 'public/models/human_body.glb'] = process.argv;
if (!input) {
  console.error('usage: node scripts/optimize-model.mjs <input.glb> [output.glb]');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const semantic of prim.listSemantics()) {
      if (semantic !== 'POSITION' && semantic !== 'NORMAL') prim.setAttribute(semantic, null);
    }
  }
}

await doc.transform(weld(), dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 8 }));

// < 65 536 vertices → 16-bit indices halve the index buffer.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    if (indices && prim.getAttribute('POSITION').getCount() < 65536) {
      indices.setArray(new Uint16Array(indices.getArray()));
    }
  }
}

const asset = root.getAsset();
asset.copyright =
  'HUMAN_BODY by vistaalienprime (https://sketchfab.com/3d-models/human-body-f022e4a3641943328b2fbfdf0f7c3e1e), CC-BY-4.0';
asset.generator = 'Forge optimize-model (glTF-Transform)';

await io.write(output, doc);
const prim = root.listMeshes()[0].listPrimitives()[0];
console.log(
  `wrote ${output}: ${prim.getAttribute('POSITION').getCount()} vertices, ${prim.getIndices().getCount() / 3} triangles`,
);
