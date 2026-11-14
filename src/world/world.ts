import * as T from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CityData, centroid, seeded, hash, roadWidth, isStreet, geo, bounds, pointInPoly, Road } from './data';
import { Materials, mesh, box, label, BASE } from './materials';
import { Batcher, flatPolygon, ribbon, walls } from './geometry';
import { CollisionWorld, BRIDGES } from './collision';
import { buildLandmarks, specialBuilding } from './landmarks';
export type Weather='golden'|'overcast'|'night';
export class World {
 root=new T.Group(); materials=new Materials();collision:CollisionWorld;
 chunks:T.Mesh[]=[];sun=new T.DirectionalLight(0xffe0b3,3.2);ambient=new T.HemisphereLight(0xc6dfed,0x697265,2.0);water!:T.ShaderMaterial;weather:Weather='golden';rain!:T.Points;time=0;
 nightLights:T.MeshStandardMaterial[]=[];stats={buildings:0,trees:0,roads:0};
 constructor(public scene:T.Scene,public data:CityData){this.collision=new CollisionWorld(data);scene.add(this.root);scene.add(this.sun,this.sun.target,this.ambient);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-95;this.sun.shadow.camera.right=95;this.sun.shadow.camera.top=95;this.sun.shadow.camera.bottom=-95;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=650;this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.065;this.sun.shadow.radius=2.5;scene.fog=new T.FogExp2(0xc2cbd0,.00032)}
 async build(report:(text:string,n:number)=>void){
  report('Loading Vancouver’s streets',.12);this.addEasternRoad();this.collision=new CollisionWorld(this.data);this.terrain();this.roads();await new Promise(r=>setTimeout(r,20));
  report('Raising the downtown skyline',.3);this.buildings();await new Promise(r=>setTimeout(r,20));
  report('Planting Stanley Park',.49);this.vegetation();await new Promise(r=>setTimeout(r,20));
  report('Building the waterfront',.68);const landmarkRoot=new T.Group();this.root.add(landmarkRoot);buildLandmarks(landmarkRoot,this.materials);this.mergeStatic(landmarkRoot);this.streetDetails();await new Promise(r=>setTimeout(r,20));
  report('Lighting the coast',.84);this.mountains();this.createRain();
  try{const hdr=await new RGBELoader().loadAsync(`${BASE}textures/sky.hdr`);hdr.mapping=T.EquirectangularReflectionMapping;this.scene.environment=hdr;this.scene.background=hdr;this.scene.backgroundRotation.y=1.8;this.scene.environmentRotation.y=1.8;this.scene.backgroundIntensity=.72;this.scene.environmentIntensity=.7;}catch{this.scene.background=new T.Color(0xb6ccd7)}
  this.setWeather('golden');report('Ready to explore',1);
 }
 addEasternRoad(){
  // Authored connector outside the extracted downtown map. The core map remains OSM geometry.
  const coords=[[49.28113,-123.097],[49.2812,-123.080],[49.2818,-123.061],[49.2823,-123.046],[49.2838,-123.032],[49.289,-123.023],[49.2941,-123.0236]];
  const r:Road={name:'East Vancouver connector',kind:'primary',pts:coords.flatMap(([lat,lon])=>geo(lat,lon))};this.data.roads.push(r);
  const north:Road={name:'North Shore approach',kind:'primary',pts:[...geo(49.3153,-123.0286),...geo(49.319,-123.034),...geo(49.324,-123.052),...geo(49.326,-123.075),...geo(49.3276,-123.13645)]};this.data.roads.push(north);
 }
 terrain(){
  const m=this.materials;const floor=mesh(new T.PlaneGeometry(24000,24000),m.grass,this.root,2000,-.09,0);floor.rotation.x=-Math.PI/2;floor.geometry.getAttribute('uv').array.forEach((_,i,a)=>a[i]*=2800);floor.castShadow=false;
  const b=new Batcher(this.root,600);for(const a of this.data.areas){if(a.kind==='water')continue;let mat=m.grass;if(['parking','plaza','campus','construction'].includes(a.kind))mat=m.concrete;if(a.kind==='beach')mat=new T.MeshStandardMaterial({color:0xb2a894,roughness:1});const [x,z]=centroid(a.pts);try{b.add(flatPolygon(a.pts,a.holes,.0,8),mat,x,z)}catch{}}
  this.chunks.push(...b.finish(false));
  this.water=new T.ShaderMaterial({uniforms:{time:{value:0},deep:{value:new T.Color(0x204b58)},sky:{value:new T.Color(0xbccdd1)},sunDir:{value:new T.Vector3(-.6,.28,-.5).normalize()},sunColor:{value:new T.Color(0xffd5a3)},night:{value:0}},vertexShader:`varying vec3 vWorld; varying vec3 vView; void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;vView=cameraPosition-wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`uniform float time;uniform vec3 deep,sky,sunDir,sunColor;uniform float night;varying vec3 vWorld;varying vec3 vView;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float wave(vec2 p){return sin(p.x*.72+time*.9)*.12+sin(p.y*.92-time*.7)*.09+noise(p*2.+time*.12)*.14+noise(p*.18-time*.08)*.4;}void main(){vec2 p=vWorld.xz;float eps=.15;float dx=wave(p+vec2(eps,0))-wave(p-vec2(eps,0));float dz=wave(p+vec2(0,eps))-wave(p-vec2(0,eps));vec3 n=normalize(vec3(-dx,.65,-dz));vec3 v=normalize(vView);float fres=pow(1.-max(dot(n,v),0.),3.);vec3 color=mix(deep,sky,fres*.85);float spec=pow(max(dot(reflect(-sunDir,n),v),0.),220.);color+=sunColor*spec*2.3*(1.-night*.8);color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);float fog=1.-exp(-length(vView)*.00035);color=mix(color,sky,fog);gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  for(const o of this.data.ocean)mesh(flatPolygon(o,[],.065,1),this.water,this.root).castShadow=false;for(const a of this.data.areas.filter(a=>a.kind==='water'))mesh(flatPolygon(a.pts,[],.065,1),this.water,this.root).castShadow=false;
  // Ocean outside the core extract, with land on either side of the inlet.
  const oceanRect=(minX:number,maxX:number,minZ:number,maxZ:number)=>mesh(flatPolygon([minX,minZ,maxX,minZ,maxX,maxZ,minX,maxZ],[],.065),this.water,this.root).castShadow=false;
  oceanRect(-12000,bounds.minX,-18000,10000);oceanRect(bounds.minX,15000,-18000,geo(49.331,-123.1)[1]);
  oceanRect(bounds.maxX,15000,geo(49.313,-123.1)[1],geo(49.294,-123.1)[1]);
  oceanRect(bounds.minX,bounds.maxX,geo(49.331,-123.1)[1],bounds.minZ);
 }
 roads(){const b=new Batcher(this.root,450),m=this.materials;const stripes=new T.MeshStandardMaterial({color:0xdfd8c0,roughness:.6});
  for(const r of this.data.roads){const [x,z]=centroid(r.pts),width=roadWidth(r),street=isStreet(r);const height=(x:number,z:number)=>this.collision.height(x,z);
   if(street)b.add(ribbon(r.pts,width+5,.045,height,5),m.concrete,x,z,'curb');b.add(ribbon(r.pts,width,street?.082:.11,height,5),street?m.asphalt:m.concrete,x,z,'road');
   if(street&&r.kind!=='residential'){
    for(let i=0;i<r.pts.length-2;i+=2){const ax=r.pts[i],az=r.pts[i+1],bx=r.pts[i+2],bz=r.pts[i+3],len=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/len,dz=(bz-az)/len;for(let t=3;t<len-3;t+=11){const end=Math.min(t+4.5,len);b.add(ribbon([ax+dx*t,az+dz*t,ax+dx*end,az+dz*end],.16,.102,height),m.yellow,ax+dx*t,az+dz*t,'stripe')}
    }
   }this.stats.roads++;
  }this.chunks.push(...b.finish(false));
 }
 buildings(){const b=new Batcher(this.root,300),m=this.materials;
  for(const building of this.data.buildings){if(specialBuilding(building))continue;const [x,z]=centroid(building.pts),rand=seeded(hash(building.id));const h=Math.max(4,(building.levels??(3+rand()*4))*3.2);const style=h>35?Math.floor(rand()*4):4+Math.floor(rand()*2);const mat=m.facades[style];mat.side=T.DoubleSide;
   try{b.add(walls(building.pts,h),mat,x,z);b.add(flatPolygon(building.pts,[],h,12),m.roof,x,z);this.stats.buildings++;
    if(h>18){const xs=building.pts.filter((_,i)=>i%2===0),zs=building.pts.filter((_,i)=>i%2);let w=Math.min(7,(Math.max(...xs)-Math.min(...xs))*.3),d=Math.min(9,(Math.max(...zs)-Math.min(...zs))*.3);const hvac=new T.BoxGeometry(w,2,d);hvac.translate(x,h+1,z);b.add(hvac,m.stone,x,z);if(h>65){const parapet=new T.BoxGeometry(w*1.4,3,d*1.4);parapet.translate(x,h+2.5,z);b.add(parapet,m.dark,x,z)}}
   }catch{}
  }this.chunks.push(...b.finish());
 }
 vegetation(){
  const rand=seeded(7503),m=this.materials,trees:number[][]=[];
  for(let i=0;i<this.data.trees.length;i+=2){const x=this.data.trees[i],z=this.data.trees[i+1];if(this.collision.water(x,z)||this.collision.blocked(x,z,1))continue;trees.push([x,z,5+rand()*9,rand()])}
  // Densify the forest interior while keeping mapped roads and trails open.
  const stanley=this.data.areas.filter(a=>['forest','park'].includes(a.kind));for(let i=0;i<4400;i++){const [x,z]=geo(49.295+rand()*.017,-123.159+rand()*.030);if(!stanley.some(a=>pointInPoly(x,z,a.pts))||this.collision.water(x,z))continue;const road=this.collision.nearestRoad(x,z,10);if(road&&road.d<7)continue;let path=false;for(const r of this.collision.roads.query(x,z,8)){for(let j=0;j<r.pts.length-2;j+=2){const ax=r.pts[j],az=r.pts[j+1],bx=r.pts[j+2],bz=r.pts[j+3],vx=bx-ax,vz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz)));if(Math.hypot(x-ax-vx*t,z-az-vz*t)<5)path=true}}if(!path)trees.push([x,z,15+rand()*17,rand()])}
  const chunkTrees=new Map<string,number[][]>();for(const t of trees){const k=Math.floor(t[0]/350)+','+Math.floor(t[1]/350);let a=chunkTrees.get(k);if(!a)chunkTrees.set(k,a=[]);a.push(t)}
  const leafMat=new T.MeshStandardMaterial({color:0x5b7648,roughness:.93});const pineMat=new T.MeshStandardMaterial({color:0x345644,roughness:.98});
  const crownGeo=new T.IcosahedronGeometry(1,2);const p=crownGeo.getAttribute('position');for(let i=0;i<p.count;i++){const n=1+(Math.sin(p.getX(i)*15+p.getY(i)*7)*Math.cos(p.getZ(i)*16))*.18;p.setXYZ(i,p.getX(i)*n,p.getY(i)*n,p.getZ(i)*n)}crownGeo.computeVertexNormals();
  const pineParts=[];for(let i=0;i<5;i++){const g=new T.ConeGeometry(1-i*.14,1.4,11,1);g.translate(0,i*.45,0);pineParts.push(g)}const pineGeo=mergeGeometries(pineParts)!;
  const dummy=new T.Object3D(),color=new T.Color();
  for(const [key,list] of chunkTrees){const trunk=new T.InstancedMesh(new T.CylinderGeometry(.6,.9,1,6),m.bark,list.length),leaves=new T.InstancedMesh(crownGeo,leafMat,list.length),pines=new T.InstancedMesh(pineGeo,pineMat,list.length);let li=0,pi=0;
   for(let i=0;i<list.length;i++){const [x,z,h,t]=list[i];dummy.position.set(x,h*.35,z);dummy.rotation.set(0,t*6.28,0);dummy.scale.set(h*.023,h*.7,h*.023);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);const pine=h>14&&t>.2;
    if(pine){dummy.position.set(x,h*.4,z);dummy.scale.set(h*.21,h*.22,h*.21);dummy.updateMatrix();pines.setMatrixAt(pi,dummy.matrix);color.setHSL(.36+t*.03,.20,.19+t*.08);pines.setColorAt(pi++,color)}else{dummy.position.set(x,h*.73,z);dummy.scale.set(h*.32,h*.44,h*.31);dummy.updateMatrix();leaves.setMatrixAt(li,dummy.matrix);color.setHSL(.23+t*.12,.21+t*.13,.24+t*.12);leaves.setColorAt(li++,color)}
   }leaves.count=li;pines.count=pi;for(const obj of [trunk,leaves,pines]){obj.castShadow=obj.receiveShadow=true;obj.computeBoundingSphere();obj.userData.center=key.split(',').map(v=>Number(v)*350+175);this.root.add(obj);this.chunks.push(obj)}
  }this.stats.trees=trees.length;
 }
 streetDetails(){const b=new Batcher(this.root,240),m=this.materials,rand=seeded(44);const lampMat=new T.MeshStandardMaterial({color:0xffedc7,emissive:0xffd48b,emissiveIntensity:2});this.nightLights.push(lampMat);const signCache=new Map<string,T.Material>();let count=0;
  for(const r of this.data.roads){if(!isStreet(r)||r.kind==='residential')continue;for(let i=0;i<r.pts.length-2;i+=2){const ax=r.pts[i],az=r.pts[i+1],bx=r.pts[i+2],bz=r.pts[i+3],len=Math.hypot(bx-ax,bz-az);if(len<20)continue;const dx=(bx-ax)/len,dz=(bz-az)/len,offset=roadWidth(r)/2+1.4;
   for(let d=15;d<len;d+=47){const side=count++%2?1:-1,x=ax+dx*d+dz*offset*side,z=az+dz*d-dx*offset*side;if(this.collision.water(x,z)||this.collision.blocked(x,z,.5))continue;const h=this.collision.height(x,z);let geo:T.BufferGeometry=new T.CylinderGeometry(.055,.09,8,6);geo.translate(x,h+4,z);b.add(geo,m.dark,x,z);geo=new T.BoxGeometry(1.4,.12,.27);geo.rotateY(-Math.atan2(dz,dx));geo.translate(x-dz*.5*side,h+8,z+dx*.5*side);b.add(geo,m.chrome,x,z);geo=new T.BoxGeometry(.85,.04,.22);geo.translate(x-dz*.5*side,h+7.92,z+dx*.5*side);b.add(geo,lampMat,x,z);
    if(count%6===0){geo=new T.CylinderGeometry(.23,.23,.85,10);geo.translate(x+1,h+.43,z);b.add(geo,m.dark,x,z)}
   }
   if(r.name&&i===0&&len>38){const x=ax+dx*10+dz*offset,z=az+dz*10-dx*offset;if(this.collision.blocked(x,z,1))continue;let mat=signCache.get(r.name);if(!mat){mat=new T.MeshStandardMaterial({map:label(r.name.toUpperCase(),512,96,'#f5f4e7','#20403c',42),roughness:.7});signCache.set(r.name,mat)}const sign=new T.BoxGeometry(3.1,.53,.07);sign.rotateY(Math.atan2(dx,dz));sign.translate(x,3.4,z);b.add(sign,mat,x,z);const pole=new T.CylinderGeometry(.045,.045,3.4,6);pole.translate(x,1.7,z);b.add(pole,m.chrome,x,z);
    // Zebra crossing near the end of this named street segment.
    for(let q=-roadWidth(r)*.5+1;q<roadWidth(r)*.5;q+=1.2){const stripe=new T.BoxGeometry(.55,.018,2.8);stripe.rotateY(Math.atan2(dx,dz));stripe.translate(ax+dx*5+dz*q,.114,az+dz*5-dx*q);b.add(stripe,m.white,x,z)}
   }
  }}this.chunks.push(...b.finish());
  // Neon entertainment street signs face Granville's actual alignment.
  const neonRoot=new T.Group();this.root.add(neonRoot);const names=['ORPHEUM','VOGUE','GRANVILLE','RAIN CITY','COMMODORE'];for(let i=0;i<names.length;i++){const [x,z]=geo(49.2807-i*.00055,-123.1217-i*.0007);const g=new T.Group();g.position.set(x+10,0,z-10);g.rotation.y=-.7;neonRoot.add(g);const mat=new T.MeshStandardMaterial({map:label(names[i],1024,192,['#efb873','#ca887f','#b9d9e0'][i%3],'#17262a',105),emissiveMap:label(names[i],1024,192,['#efb873','#ca887f','#b9d9e0'][i%3],'#000000',105),emissive:0xffffff,emissiveIntensity:1.3});box(g,mat,0,7,0,9,1.9,.5);this.nightLights.push(mat)}this.mergeStatic(neonRoot);
 }
 mergeStatic(root:T.Group){root.updateWorldMatrix(true,true);const batch=new Batcher(this.root,400),remove:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&o.geometry&&!(o instanceof T.InstancedMesh)&&!Array.isArray(o.material)){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));const p=new T.Vector3();o.getWorldPosition(p);batch.add(g,o.material,p.x,p.z);remove.push(o)}});remove.forEach(o=>o.removeFromParent());this.chunks.push(...batch.finish())}
 mountains(){const rand=seeded(451);for(let layer=0;layer<3;layer++){const width=28000,depth=5500,g=new T.PlaneGeometry(width,depth,200,35);g.rotateX(-Math.PI/2);const p=g.getAttribute('position'),colors:number[]=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);const ridge=(Math.sin(x*.0007+layer*2)*.5+.5)*650+(Math.sin(x*.0017+.6)+1)*270+(Math.cos(x*.0034)*.5+.5)*180;const profile=Math.pow(Math.sin((z/depth+.5)*Math.PI),1.4);let y=(600+ridge+rand()*60)*profile;p.setY(i,y);const snow=y>1250?Math.min(1,(y-1250)/240):0;const c=new T.Color(layer===0?0x5c7277:0x859598).lerp(new T.Color(0xe3e9e7),snow);colors.push(c.r,c.g,c.b)}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mountain=mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),this.root,2000,-70,-6600-layer*1600);mountain.castShadow=false}}
 createRain(){const a=new Float32Array(2000*3),rand=seeded(24);for(let i=0;i<a.length;i+=3){a[i]=(rand()-.5)*70;a[i+1]=rand()*40;a[i+2]=(rand()-.5)*70}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));this.rain=new T.Points(g,new T.PointsMaterial({color:0xc3dae1,size:.04,transparent:true,opacity:.4,depthWrite:false}));this.scene.add(this.rain)}
 setWeather(w:Weather){this.weather=w;const night=w==='night',rain=w==='overcast';this.sun.color.set(night?0xaec9f9:rain?0xcbd9e2:0xffd7a1);this.sun.intensity=night?.35:rain?1.3:3.5;this.ambient.intensity=night?.65:rain?2.2:2;this.ambient.color.set(night?0x4f6d90:0xc7dde8);this.scene.backgroundIntensity=night?.035:rain?.52:.76;this.scene.environmentIntensity=night?.34:rain?.8:.75;const fog=(this.scene.fog as T.FogExp2);fog.color.set(night?0x152738:rain?0x9daeb8:0xc1cbd0);fog.density=night?.0008:rain?.0007:.0003;this.materials.setNight(night?1:.16);this.materials.asphalt.roughness=rain?.23:.43;this.materials.asphalt.metalness=rain?.28:.12;this.rain.visible=rain;this.water.uniforms.deep.value.set(night?0x091923:rain?0x344d57:0x255464);this.water.uniforms.sky.value.copy(fog.color);this.water.uniforms.night.value=night?1:0;this.nightLights.forEach(m=>m.emissiveIntensity=night?3.3:1.1)}
 update(dt:number,x:number,z:number){this.time+=dt;this.water.uniforms.time.value=this.time;const sx=Math.round(x/2)*2,sz=Math.round(z/2)*2;this.sun.position.set(sx-140,210,sz-210);this.sun.target.position.set(sx,0,sz);this.rain.position.set(x,0,z);if(this.rain.visible){const a=this.rain.geometry.getAttribute('position');for(let i=0;i<a.count;i++){let y=a.getY(i)-dt*25;if(y<0)y=40;a.setY(i,y)}a.needsUpdate=true}for(const c of this.chunks){const p=c.userData.center;if(!p)continue;const dist=Math.hypot(p[0]-x,p[1]-z);c.visible=dist<(c instanceof T.InstancedMesh?1550:2900);c.castShadow=dist<210}}
}
