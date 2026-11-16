/** Local-only extraction of already licensed source images; no network. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const source='public/models/forest/fir_tree_01-medium.glb';
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(source);
const m=doc.getRoot().listMaterials().find(m=>m.getName()==='fir_tree_01_twig');
if(!m)throw new Error('Expected licensed twig material missing');
const out='public/textures/gallery-conifers';await fs.mkdir(out,{recursive:true});
const images=[];
for(const [role,texture] of [['color',m.getBaseColorTexture()],['normal',m.getNormalTexture()]]){
  if(!texture||texture.getMimeType()!=='image/webp'||texture.getSize().join(',')!=='1024,1024')throw new Error('Unexpected source atlas');
  const bytes=texture.getImage(),path=`${out}/${role}.webp`;await fs.writeFile(path,bytes);
  images.push({role,file:path.replace('public/',''),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sourceTexture:texture.getName()});
}
await fs.writeFile(`${out}/SOURCES.json`,JSON.stringify({asset:'Fir Tree 01',authors:['Rob Tuytel','Rico Cilliers'],url:'https://polyhaven.com/a/fir_tree_01',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',sourceModel:source,sourceSha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),modification:'Exact embedded image extraction without resampling; original static branch-spray geometry uses selected UV subregions. Fir needle detail is a botanical approximation for photographically registered columnar conifers, not a species identification.',regenerate:'node scripts/prepare-gallery-conifer-foliage.mjs',images},null,2)+'\n');console.log(images);
