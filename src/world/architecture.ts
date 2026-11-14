import * as T from 'three';
import { CityData, centroid, hash, seeded, Road, segmentPoint } from './data';
import {Materials,label} from './materials';
import { Batcher, walls, flatPolygon } from './geometry';
import {specialBuilding} from './landmarks';
import {CollisionWorld} from './collision';
function tint(g:T.BufferGeometry,c:T.Color){const a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new T.BufferAttribute(a,3));return g}
function sideBox(x:number,y:number,z:number,w:number,h:number,d:number,a:number){const g=new T.BoxGeometry(w,h,d);g.rotateY(a);g.translate(x,y,z);return g}
export function architecture(parent:T.Group,data:CityData,m:Materials,collision:CollisionWorld){
 const shell=new Batcher(parent,270),detail=new Batcher(parent,170);let count=0;
 const shopNames=['PACIFIC COFFEE','HARBOUR MARKET','WEST END BOOKS','NORTH SHORE OUTFITTERS','WATER STREET','COASTAL LIVING','THE CORNER','VANCOUVER'];
 const signMaterials=shopNames.map((s,i)=>new T.MeshStandardMaterial({map:label(s,1024,128,['#e1d9c4','#cad9d8','#e2dacd'][i%3],['#263a39','#302c2a','#2b353b'][i%3],59),roughness:.76}));
 const shopGlass=new T.MeshPhysicalMaterial({color:0x233a40,metalness:.35,roughness:.14,clearcoat:.8});const frames=new T.MeshStandardMaterial({color:0x313b3d,metalness:.5,roughness:.5}),ledge=new T.MeshStandardMaterial({color:0xa9ada8,roughness:.79});
 m.facades.forEach(mat=>{mat.vertexColors=true;mat.side=T.DoubleSide});
 for(const b of data.buildings){if(specialBuilding(b))continue;const [x,z]=centroid(b.pts),rand=seeded(hash(b.id)),h=Math.max(4,(b.levels??(2+rand()*5))*3.2),style=h>35?Math.floor(rand()*8):8+Math.floor(rand()*4),mat=m.facades[style];const color=new T.Color().setHSL(.06+rand()*.13,.025+rand()*.055,.62+rand()*.30);
 const xs=b.pts.filter((_,i)=>!(i%2)),zs=b.pts.filter((_,i)=>i%2),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);const tower=h>44&&w*d>450,podium=tower?Math.min(15,h*.19):0,shrink=tower?.66+rand()*.2:1;const outline=b.pts.map((v,i)=>(i%2?z:x)+(v-(i%2?z:x))*shrink);
 try{
  if(tower){shell.add(tint(walls(b.pts,podium),color),m.facades[style%2?3:7],x,z);shell.add(flatPolygon(b.pts,[],podium,5),m.roof,x,z);const towerGeo=walls(outline,h-podium);towerGeo.translate(0,podium,0);shell.add(tint(towerGeo,color),mat,x,z)}else shell.add(tint(walls(outline,h),color),mat,x,z);
  shell.add(flatPolygon(outline,[],h,8),m.roof,x,z);count++;
  // Parapets, ledges, floor plates and corner piers make the silhouette dimensional.
  for(let i=0;i<outline.length;i+=2){const j=(i+2)%outline.length,ax=outline[i],az=outline[i+1],bx=outline[j],bz=outline[j+1],len=Math.hypot(bx-ax,bz-az),angle=-Math.atan2(bz-az,bx-ax);if(len<1.2)continue;
   detail.add(sideBox((ax+bx)/2,h+.27,(az+bz)/2,len,.55,.35,angle),ledge,x,z);
   if(h>24&&style%3===0){for(let y=podium+3.2;y<h;y+=6.4)detail.add(sideBox((ax+bx)/2,y,(az+bz)/2,len,.16,.23,angle),ledge,x,z)}
   if(h>35&&i%4===0){detail.add(sideBox(ax,(h+podium)/2,az,.38,h-podium,.38,angle),frames,x,z)}
  }
  // A stepped crown and roof equipment break up the uniformly flat tower tops.
  if(h>30){const rh=2+rand()*4,rw=Math.min(10,w*.3),rd=Math.min(12,d*.3);shell.add(sideBox(x,h+rh/2,z,rw,rh,rd,0),m.stone,x,z);for(let k=0;k<2+Math.floor(rand()*3);k++){const xx=x+(rand()-.5)*w*.35,zz=z+(rand()-.5)*d*.35;detail.add(sideBox(xx,h+.65,zz,1.8,1.3,2.4,0),frames,x,z);const fan=new T.CylinderGeometry(.55,.55,.12,14);fan.translate(xx,h+1.36,zz);detail.add(fan,m.chrome,x,z)}if(h>95&&rand()>.4){const aerial=new T.CylinderGeometry(.08,.14,11,6);aerial.translate(x,h+rh+5.5,z);shell.add(aerial,m.chrome,x,z)}}
  if(podium){const roofBand=new T.BoxGeometry(Math.min(w*.35,15),.8,Math.min(d*.4,17));roofBand.translate(x-w*.24,podium+.45,z+d*.23);detail.add(roofBand,m.grass,x,z)}
  // Only mapped street-facing edges get shopfronts; alleys keep their service appearance.
  for(let i=0;i<b.pts.length;i+=2){const j=(i+2)%b.pts.length,ax=b.pts[i],az=b.pts[i+1],bx=b.pts[j],bz=b.pts[j+1],len=Math.hypot(bx-ax,bz-az);if(len<8||len>130)continue;const cx=(ax+bx)/2,cz=(az+bz)/2,near=collision.nearestRoad(cx,cz,30);if(!near||near.d<2)continue;let nx=-(bz-az)/len,nz=(bx-ax)/len;if(nx*(near.x-cx)+nz*(near.z-cz)<0){nx=-nx;nz=-nz}const angle=Math.atan2(nx,nz),segments=Math.max(1,Math.floor(len/6)),bay=len/segments;
   for(let s=0;s<segments;s++){const t=(s+.5)/segments,xx=ax+(bx-ax)*t,zz=az+(bz-az)*t;detail.add(sideBox(xx+nx*.10,1.95,zz+nz*.1,bay-.4,3.25,.1,angle),shopGlass,x,z);for(const off of [-bay/2+.15,bay/2-.15]){const px=xx+Math.cos(angle)*off,pz=zz-Math.sin(angle)*off;detail.add(sideBox(px+nx*.19,1.95,pz+nz*.19,.24,3.8,.32,angle),ledge,x,z)}detail.add(sideBox(xx+nx*.18,3.66,zz+nz*.18,bay,.15,.3,angle),frames,x,z);detail.add(sideBox(xx+nx*.18,.3,zz+nz*.18,bay,.2,.3,angle),frames,x,z)}
   const signWidth=Math.min(len-1,18),signMat=signMaterials[Math.floor(rand()*signMaterials.length)];detail.add(sideBox(cx+nx*.35,4.18,cz+nz*.35,signWidth,.64,.2,angle),signMat,x,z);
   if(rand()>.55){detail.add(sideBox(cx+nx*1.0,3.56,cz+nz*1.0,Math.min(10,len*.6),.15,2.3,angle),frames,x,z);for(const s of [-1,1]){const xx=cx+Math.cos(angle)*Math.min(4,len*.22)*s+nx*1.8,zz=cz-Math.sin(angle)*Math.min(4,len*.22)*s+nz*1.8;detail.add(sideBox(xx,1.75,zz,.065,3.5,.065,0),frames,x,z)}}
   // Entrance door, handle and a warm interior light strip.
   detail.add(sideBox(cx+nx*.24,1.45,cz+nz*.24,1.3,2.65,.12,angle),frames,x,z);detail.add(sideBox(cx+nx*.33,1.49,cz+nz*.33,1.05,2.34,.03,angle),shopGlass,x,z);detail.add(sideBox(cx+nx*.39+Math.cos(angle)*.38,1.43,cz+nz*.39-Math.sin(angle)*.38,.035,.42,.035,angle),m.chrome,x,z);
  }
 }catch(e){console.warn('Building geometry skipped',b.id,e)}
 }
 const chunks=shell.finish(),details=detail.finish();details.forEach(c=>c.userData.detail=true);return {chunks:[...chunks,...details],count};
}
