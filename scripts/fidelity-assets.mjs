import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('public/asset-manifest.json','utf8'));
const save=async(url,file,license='CC0',credit='Poly Haven')=>{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status} ${url}`);await fs.mkdir(file.substring(0,file.lastIndexOf('/')),{recursive:true});await fs.writeFile(file,Buffer.from(await r.arrayBuffer()));manifest.push({file:file.replace('public/',''),source:url,license,credit});console.log(file)};
const carBase='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/';
const readme=await(await fetch(carBase+'README.md')).text();console.log(readme.slice(readme.indexOf('## Legal')));await fs.writeFile('docs/CAR-ASSET-SOURCE.md',readme);
await save(carBase+'glTF-Binary/CarConcept.glb','public/models/car-concept.glb','CC-BY-4.0','Eric Chadwick / Darmstadt Graphics Group GmbH; source model by Unity Fan');
for(const [id,file] of [['belfast_sunset_puresky','sunset'],['modern_evening_street','city-reflections'],['kloofendal_overcast_puresky','overcast']]){const d=await(await fetch(`https://api.polyhaven.com/files/${id}`)).json();await save(d.hdri['2k'].hdr.url,`public/textures/${file}.hdr`)}
for(const id of ['brick_wall_001','rectangular_facade_tiles','concrete_tile_facade']){const d=await(await fetch(`https://api.polyhaven.com/files/${id}`)).json();for(const [k,s]of[['Diffuse','color'],['nor_gl','normal']]){const f=d[k]?.['1k']?.jpg;if(f)await save(f.url,`public/textures/${id}-${s}.jpg`)}}
for(const id of ['tree_small_02','fir_tree_01']){const d=await(await fetch(`https://api.polyhaven.com/files/${id}`)).json();for(const k of id==='tree_small_02'?['leaves_diff','leaves_alpha','branch_diff']:['twig_diff','twig_alpha','bark_diff']){const f=d[k]?.['1k']?.png;if(f)manifest.push({file:`textures/${id}-${k}.png`,source:f.url,license:'CC0',credit:'Poly Haven'})}}
await fs.writeFile('public/asset-manifest.json',JSON.stringify(manifest,null,2));
