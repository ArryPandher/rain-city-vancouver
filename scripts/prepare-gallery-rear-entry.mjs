// Reproduce exact vertex ranges from the shipped quantized source GLB.
// Component bounds identify the original kit's rear stairs, columns and pediment;
// runtime uses the reviewed ranges, never a broad spatial selection.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const file='public/models/vancouver/vancouver-art-gallery.glb';
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file);
const angle=.7769452205671321,c=Math.cos(angle),s=Math.sin(angle);
const result={source:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),angle,translationV:11.33,materials:{}};
for(const node of doc.getRoot().listNodes()) for(const primitive of node.getMesh()?.listPrimitives()??[]) {
  const name=primitive.getMaterial().getName();
  if(!['foundation','trim','stone'].includes(name))continue;
  const a=primitive.getAttribute('POSITION'),raw=new T.BufferAttribute(a.getArray(),3,a.getNormalized()),matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
  const points=Array.from({length:raw.count},(_,i)=>new T.Vector3(raw.getX(i),raw.getY(i),raw.getZ(i)).applyMatrix4(matrix));
  const index=primitive.getIndices().getArray(),parent=Array.from({length:raw.count},(_,i)=>i);
  const find=v=>parent[v]===v?v:(parent[v]=find(parent[v]));
  for(let i=0;i<index.length;i+=3){const root=find(index[i]);parent[find(index[i+1])]=root;parent[find(index[i+2])]=root;}
  const groups=new Map();for(let i=0;i<points.length;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}
  const selected=[],components=[];
  for(const ids of groups.values()){
    const box=new T.Box3();for(const i of ids){const p=points[i];box.expandByPoint(new T.Vector3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z));}
    const lo=box.min,hi=box.max;
    const keep=name==='foundation'?lo.x> -7.77&&hi.x<3.97&&lo.y>-.01&&hi.y<3.22&&lo.z>12.08&&hi.z<16.32:
      name==='trim'?lo.y>3.18&&hi.y<13.92&&lo.z>11.55&&hi.z<12.80&&((lo.x> -9.45&&hi.x< -8.15)||(lo.x>4.30&&hi.x<5.60)):
      lo.x> -11.02&&hi.x<7.22&&lo.y>13.53&&hi.y<16.91&&lo.z>11.24&&hi.z<12.76;
    // The core's six sill reveals and six meeting rails overlap the old broad
    // entry bounds, but belong to its stationary upper windows, not the pediment.
    const coreWindowQuad=name==='stone'&&ids.length===4&&lo.z>11.61&&hi.z<11.91&&lo.y>14.49&&hi.y<16.06&&hi.y-lo.y<.12;
    if(keep&&!coreWindowQuad){selected.push(...ids);components.push({vertices:ids.length,min:lo.toArray().map(x=>+x.toFixed(3)),max:hi.toArray().map(x=>+x.toFixed(3))});}
  }
  selected.sort((a,b)=>a-b);const ranges=[];for(const i of selected){const last=ranges.at(-1);if(last&&last[1]+1===i)last[1]=i;else ranges.push([i,i]);}
  result.materials[name]={positionCount:raw.count,indexCount:index.length,selectedVertices:selected.length,ranges,components};
}
fs.writeFileSync('src/world/gallery-rear-entry-data.json',JSON.stringify(result,null,2)+'\n');
console.log(Object.fromEntries(Object.entries(result.materials).map(([k,v])=>[k,{vertices:v.selectedVertices,components:v.components.length,ranges:v.ranges.length}])));
