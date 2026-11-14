import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,simplify} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {simplifyLeaves} from './lib/street-leaves.mjs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const source='public/models/vancouver-street-tree.glb';
const doc=await io.read(source), leafParts=[];
let leafStats;
for(const mesh of doc.getRoot().listMeshes())for(const primitive of [...mesh.listPrimitives()]){
 if(!primitive.getMaterial()?.getName().includes('leaves'))continue;
 const result=await simplifyLeaves(primitive,2,.35);
 leafStats=result.stats;
 const buffer=doc.getRoot().listBuffers()[0];
 const acc=(type,array)=>doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
 primitive.setAttribute('POSITION',acc('VEC3',result.positions))
  .setAttribute('NORMAL',acc('VEC3',result.normals))
  .setAttribute('TEXCOORD_0',acc('VEC2',result.uvs))
  .setIndices(acc('SCALAR',result.indices));
 mesh.removePrimitive(primitive);leafParts.push([mesh,primitive]);
}
await MeshoptSimplifier.ready;
await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.08,error:.025}));
for(const [mesh,primitive] of leafParts)mesh.addPrimitive(primitive);
await doc.transform(dedup(),prune());
const output='public/models/vancouver-street-tree-far.glb';
await io.write(output,doc);
const triangles=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
const record={source,original:'https://polyhaven.com/a/tree_small_02',license:'CC0-1.0',output,changes:'Further per-component 3D simplification of the committed source-shaped near tree. Every leaf component retained with original UVs and normals; no leaf removal or UV-hull reconstruction. Intended for distance only.',leafStats,triangles};
await fs.writeFile('docs/sources/vancouver-street-tree-far.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
