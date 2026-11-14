import * as T from 'three';
import { Materials, box, mesh, beam, label } from './materials';
import { geo, centroid, Building } from './data';
import { BRIDGES, bridgeY } from './collision';
import { ribbon } from './geometry';
export const SPECIALS=[{p:geo(49.28845,-123.1118),r:123},{p:geo(49.2734,-123.1036),r:62},{p:geo(49.28463,-123.11195),r:43},{p:geo(49.2768,-123.1118),r:153}];
export function specialBuilding(b:Building){const c=centroid(b.pts);return SPECIALS.some(s=>Math.hypot(c[0]-s.p[0],c[1]-s.p[1])<s.r)}
export function buildLandmarks(parent:T.Group,m:Materials){
 const landmarkGroups:T.Group[]=[];
 function place(lat:number,lon:number,angle=0){const g=new T.Group();const [x,z]=geo(lat,lon);g.position.set(x,0,z);g.rotation.y=angle;parent.add(g);landmarkGroups.push(g);return g}
 const blue=new T.MeshPhysicalMaterial({color:0x506e73,metalness:.5,roughness:.23,clearcoat:.8});const sail=new T.MeshStandardMaterial({color:0xf7f4e7,roughness:.75,side:T.DoubleSide});const green=new T.MeshStandardMaterial({color:0x476550,roughness:.88});
 // Canada Place: five independently peaked tensile roofs above the pier.
 {
 const g=place(49.28845,-123.1118,-.39);box(g,m.concrete,0,-.05,0,106,1,332);box(g,m.stone,0,10,0,76,20,288);box(g,blue,0,19,0,78,12,270);
 for(let s=0;s<5;s++){
  const cz=-121+s*60;const pos:number[]=[],uv:number[]=[],idx:number[]=[];const nx=20,nz=20;
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const u=x/nx,v=z/nz;const h=24+Math.pow(Math.sin(u*Math.PI),.7)*Math.pow(Math.sin(v*Math.PI),1.1)*30;pos.push((u-.5)*78,h,cz+(v-.5)*60);uv.push(u,v);if(x<nx&&z<nz){const a=z*(nx+1)+x;idx.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1)}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(geo,sail,g);
  beam(g,m.white,new T.Vector3(0,20,cz),new T.Vector3(0,58,cz),.36,12);for(const sx of [-39,39])for(const zz of [-30,30])beam(g,m.chrome,new T.Vector3(0,56,cz),new T.Vector3(sx,24,cz+zz),.1,5);
 }
 for(const x of [-48,48])for(let z=-150;z<=150;z+=12){box(g,m.chrome,x,1.25,z,.09,2.5,.09);if(z<150)beam(g,m.chrome,new T.Vector3(x,2.5,z),new T.Vector3(x,2.5,z+12),.07,5)}
 const sign=new T.MeshStandardMaterial({map:label('CANADA PLACE',1024,128,'#f6f1e1','#254047',56),roughness:.5});box(g,sign,0,14,147,52,5,.3);
 // Harbour cruise ship, in-world scale with deck railings and lifeboats.
 const ship=new T.Group();ship.position.set(122,0,-25);g.add(ship);box(ship,m.white,0,7,0,34,14,240);box(ship,blue,0,16,0,31,3,214);for(let k=0;k<4;k++)box(ship,m.white,0,19+k*3,8,30-k*2,2.7,192-k*12);for(const side of [-1,1])for(let z=-84;z<90;z+=18)box(ship,new T.MeshStandardMaterial({color:0xd99237,roughness:.5}),side*17,12,z,3,3,11);box(ship,m.dark,0,36,-40,11,14,20);
 }
 // Harbour Centre: the recognisable observation ring.
 {const g=place(49.28463,-123.11195);box(g,m.concrete,0,16,0,61,32,54);box(g,blue,0,68,0,25,88,25);mesh(new T.CylinderGeometry(11,13,70,20),m.stone,g,0,111,0);mesh(new T.CylinderGeometry(26,19,7,48),m.concrete,g,0,146,0);mesh(new T.CylinderGeometry(26,26,9,48),blue,g,0,153,0);mesh(new T.CylinderGeometry(20,27,4,48),m.white,g,0,159,0);mesh(new T.CylinderGeometry(5,7,8,24),m.stone,g,0,164,0);beam(g,m.chrome,new T.Vector3(0,168,0),new T.Vector3(0,181,0),.25)}
 // Science World's triangulated geodesic dome.
 {const g=place(49.2734,-123.1036);mesh(new T.CylinderGeometry(46,49,12,48),m.concrete,g,0,6,0);mesh(new T.CylinderGeometry(38,38,8,48),blue,g,0,16,0);const sg=new T.IcosahedronGeometry(24,3);mesh(sg,new T.MeshStandardMaterial({color:0x899fa5,metalness:.65,roughness:.25,flatShading:true}),g,0,44,0);const edge=new T.LineSegments(new T.EdgesGeometry(sg,1),new T.LineBasicMaterial({color:0xdfebe8}));edge.position.y=44;g.add(edge);mesh(new T.CylinderGeometry(11,18,8,24),m.white,g,0,21,0)}
 // BC Place: inflated white roof and radial mast crown.
 {const g=place(49.2768,-123.1118,-.58);const base=mesh(new T.CylinderGeometry(118,126,28,72),m.concrete,g,0,14,0);base.scale.z=.78;const roof=mesh(new T.SphereGeometry(115,64,24,0,Math.PI*2,0,Math.PI/2),sail,g,0,31,0);roof.scale.set(1,.24,.77);for(let i=0;i<36;i++){const a=i*Math.PI/18;beam(g,m.white,new T.Vector3(Math.sin(a)*119,20,Math.cos(a)*93),new T.Vector3(Math.sin(a)*108,66,Math.cos(a)*84),.45);beam(g,m.chrome,new T.Vector3(Math.sin(a)*108,66,Math.cos(a)*84),new T.Vector3(Math.sin(a)*50,54,Math.cos(a)*38),.13)}const o=mesh(new T.CylinderGeometry(26,26,1,48),m.dark,g,0,58,0);o.scale.z=.76}
 // Robson Square's stepped planters and reflecting pools occupy the open plaza.
 {const g=place(49.28214,-123.1212,-.70);for(let j=0;j<4;j++){box(g,m.concrete,16+j*3,.35+j*.18,j*13,36,1.2,9);box(g,m.grass,16+j*3,1.01+j*.18,j*13,33,.1,6)}const water=new T.MeshPhysicalMaterial({color:0x375b5f,metalness:.45,roughness:.12,clearcoat:1});box(g,m.concrete,-10,.1,8,21,.3,38);box(g,water,-10,.3,8,19,.08,36);for(let i=0;i<7;i++)box(g,m.concrete,-28,.1+i*.12,-25+i*.65,20,.22,.68);for(let j=0;j<5;j++){beam(g,m.chrome,new T.Vector3(-35,0,j*7),new T.Vector3(-35,3.8,j*7),.08);beam(g,m.chrome,new T.Vector3(-35,3.8,j*7),new T.Vector3(-20,3.8,j*7),.08)}
 const art=place(49.28297,-123.12056,-.7);box(art,m.stone,0,7,0,66,14,44);for(let x=-25;x<=25;x+=5)mesh(new T.CylinderGeometry(.7,.82,9,16),m.white,art,x,6.5,24);box(art,m.white,0,12,26,62,2,8);const ped=new T.ConeGeometry(20,7,4);const roof=mesh(ped,m.white,art,0,17,26);roof.scale.set(1.7,.6,.3);roof.rotation.y=Math.PI/4;}
 // Gastown steam clock and heritage street placards.
 {const g=place(49.28441,-123.1089);box(g,m.dark,0,1.6,0,1.3,3.2,1.3);box(g,m.chrome,0,3.5,0,1.6,.45,1.6);mesh(new T.ConeGeometry(1,1.1,4),m.dark,g,0,5,0);const clockMat=new T.MeshStandardMaterial({map:label('XII\n',128,128,'#273431','#ece2c5',45),emissive:0xf6db9b,emissiveIntensity:.22});for(let i=0;i<4;i++){const face=mesh(new T.CircleGeometry(.52,32),clockMat,g,Math.sin(i*Math.PI/2)*.82,4.07,Math.cos(i*Math.PI/2)*.82);face.rotation.y=i*Math.PI/2}}
 // Small boats in Coal Harbour.
 for(let j=0;j<18;j++){const g=place(49.292+j%4*.00023,-123.124-(Math.floor(j/4))*.0004,-.7);box(g,m.white,0,1,0,3.3,2,10);box(g,m.dark,0,2,0,2.8,.1,5);beam(g,m.chrome,new T.Vector3(0,1,0),new T.Vector3(0,14,0),.06,6);beam(g,m.chrome,new T.Vector3(0,5,0),new T.Vector3(0,4,5),.04,5)}
 // Bridges have playable continuous elevation profiles matching their rendered deck.
 for(const b of BRIDGES){const g=new T.Group();parent.add(g);const length=Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1]),n=Math.ceil(length/12),points:number[]=[];for(let i=0;i<=n;i++){const t=i/n;points.push(b.a[0]+(b.b[0]-b.a[0])*t,b.a[1]+(b.b[1]-b.a[1])*t)}const height=(x:number,z:number)=>{const t=Math.hypot(x-b.a[0],z-b.a[1])/length;return bridgeY(b,Math.min(1,t))};mesh(ribbon(points,b.width,.0,height),m.asphalt,g);const dx=(b.b[0]-b.a[0])/length,dz=(b.b[1]-b.a[1])/length,nx=dz,nz=-dx;const p=(t:number,side:number,y:number)=>new T.Vector3(b.a[0]+dx*length*t+nx*side,b.a[1]*0+y,b.a[1]+dz*length*t+nz*side);
 for(let i=0;i<n;i++){const t=i/n,tt=(i+1)/n;for(const s of [-1,1]){const edge=b.width/2*s;beam(g,m.concrete,p(t,edge,bridgeY(b,t)+.5),p(tt,edge,bridgeY(b,tt)+.5),.4,6);if(i%3===0)beam(g,m.chrome,p(t,edge,bridgeY(b,t)+.5),p(t,edge,bridgeY(b,t)+2),.06,5);beam(g,m.chrome,p(t,edge,bridgeY(b,t)+2),p(tt,edge,bridgeY(b,tt)+2),.05,5)}if(i%2===0){const strip=ribbon(points.slice(i*2,Math.min((i+2)*2,points.length)),.18,.045,height);mesh(strip,m.yellow,g)}}
 for(let t=.1;t<1;t+=.13){const y=bridgeY(b,t);for(const s of [-1,1])beam(g,m.concrete,p(t,b.width*.29*s,-6),p(t,b.width*.29*s,y-1),1.7,8)}
 if(b.style==='suspension'){
  const steel=new T.MeshStandardMaterial({color:0x487e6d,metalness:.35,roughness:.57});for(const t of [.28,.73]){for(const s of [-1,1]){beam(g,steel,p(t,s*13,-8),p(t,s*13,102),1.6,8)}for(let y=35;y<100;y+=15){beam(g,steel,p(t,-13,y),p(t,13,y),1.1,8);beam(g,steel,p(t,-13,y),p(t,13,y+13),.45,6)}}
  for(const s of [-1,1])for(let i=0;i<70;i++){const t=i/70,tt=(i+1)/70;const cable=(t:number)=>t<.28?12+90*t/.28:t>.73?102-90*(t-.73)/.27:53+49*Math.pow((t-.505)/.225,2);beam(g,steel,p(t,s*12,cable(t)),p(tt,s*12,cable(tt)),.4,6);if(i%2===0)beam(g,m.chrome,p(t,s*12,bridgeY(b,t)+1),p(t,s*12,cable(t)),.1,5)}
 }else if(b.style==='truss'){
  const steel=new T.MeshStandardMaterial({color:b.id==='ironworkers'?0x5b7f80:0x687679,metalness:.35,roughness:.6});const count=Math.floor(length/40);for(let i=3;i<count-3;i++){const t=i/count,tt=(i+1)/count,y=bridgeY(b,t),yy=bridgeY(b,tt);for(const s of [-1,1]){beam(g,steel,p(t,s*b.width*.47,y+15),p(tt,s*b.width*.47,yy+15),.45,6);beam(g,steel,p(t,s*b.width*.47,y),p(t,s*b.width*.47,y+15),.45,6);beam(g,steel,p(t,s*b.width*.47,y),p(tt,s*b.width*.47,yy+15),.28,6)}beam(g,steel,p(t,-b.width*.47,y+15),p(t,b.width*.47,y+15),.35,6)}
 }
 }
 return landmarkGroups;
}
