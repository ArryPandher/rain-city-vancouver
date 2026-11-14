import fs from 'node:fs/promises';
const manifest=[];
for (const id of ['asphalt_02','concrete_pavement','aerial_grass_rock']) {
 const files=await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
 for(const [key,suffix] of [['Diffuse','color'],['nor_gl','normal'],['Rough','roughness']]) {
  const file=files[key]?.['1k']?.jpg;if(!file)continue;
  const res=await fetch(file.url);if(!res.ok)throw new Error(file.url);
  const name=`${id}-${suffix}.jpg`;await fs.writeFile(`public/textures/${name}`,Buffer.from(await res.arrayBuffer()));manifest.push({file:`textures/${name}`,source:file.url,license:'CC0',credit:'Poly Haven'});console.log(name);
 }
}
const id='kloofendal_48d_partly_cloudy_puresky';const files=await(await fetch(`https://api.polyhaven.com/files/${id}`)).json();const hdri=files.hdri['2k'].hdr;await fs.writeFile('public/textures/sky.hdr',Buffer.from(await(await fetch(hdri.url)).arrayBuffer()));manifest.push({file:'textures/sky.hdr',source:hdri.url,license:'CC0',credit:'Poly Haven'});
await fs.writeFile('public/asset-manifest.json',JSON.stringify(manifest,null,2));
