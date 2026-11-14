import * as T from 'three';
import { seeded } from './data';
export const BASE=import.meta.env.BASE_URL;
export class Materials {
 loader=new T.TextureLoader();
 asphalt:T.MeshStandardMaterial;concrete:T.MeshStandardMaterial;grass:T.MeshStandardMaterial;
 stone=new T.MeshStandardMaterial({color:0x9b9890,roughness:.87});
 dark=new T.MeshStandardMaterial({color:0x1d2528,roughness:.55,metalness:.45});
 white=new T.MeshStandardMaterial({color:0xe2e2d8,roughness:.55});
 chrome=new T.MeshStandardMaterial({color:0xabb4b6,metalness:.85,roughness:.25});
 bark=new T.MeshStandardMaterial({color:0x484239,roughness:1});
 glass=new T.MeshPhysicalMaterial({color:0x74969c,metalness:.55,roughness:.12,clearcoat:1});
 yellow=new T.MeshStandardMaterial({color:0xd9bf6a,roughness:.6});
 facades:T.MeshStandardMaterial[]=[];roof=new T.MeshStandardMaterial({color:0x647276,roughness:.8});
 constructor(){
  this.asphalt=this.pbr('asphalt_02',0x92999b,.48);this.asphalt.normalScale.set(.42,.42);this.asphalt.metalness=.12;
  this.concrete=this.pbr('concrete_pavement',0xb4b0a7,.84);this.grass=this.pbr('aerial_grass_rock',0x688052,.97);
  for(let i=0;i<6;i++)this.facades.push(this.facade(i));
 }
 texture(name:string,color=false){const t=this.loader.load(`${BASE}textures/${name}`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;return t}
 pbr(id:string,color:number,roughness:number){return new T.MeshStandardMaterial({color,map:this.texture(`${id}-color.jpg`,true),normalMap:this.texture(`${id}-normal.jpg`),roughnessMap:this.texture(`${id}-roughness.jpg`),roughness,normalScale:new T.Vector2(.5,.5)})}
 facade(style:number){
  const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d')!;
  const e=document.createElement('canvas');e.width=512;e.height=1024;const ec=e.getContext('2d')!;ec.fillStyle='#000';ec.fillRect(0,0,512,1024);
  const rand=seeded(110+style),brick=style>=4;
  const bases=['#73949d','#637c84','#8a989b','#b2b0a7','#6b4c3f','#aaa19a'];ctx.fillStyle=bases[style];ctx.fillRect(0,0,512,1024);
  if(brick){for(let row=0;row<128;row++){for(let col=0;col<20;col++){ctx.fillStyle=`rgba(0,0,0,${.06+rand()*.1})`;ctx.fillRect(col*28-(row%2)*14,row*8,27,1)}}}
  for(let row=0;row<16;row++)for(let col=0;col<8;col++){
   const x=col*64,y=row*64;const lit=rand()>.74;const margin=brick?13:3;
   ctx.fillStyle=brick?'#302d2a':'#253e49';ctx.fillRect(x+margin,y+5,64-margin*2,50);
   const grad=ctx.createLinearGradient(x,y,x+60,y+55);grad.addColorStop(0,lit?'#948c72':'#8fa8b0');grad.addColorStop(.48,lit?'#beb294':'#526e7a');grad.addColorStop(1,lit?'#646354':'#344b56');ctx.fillStyle=grad;ctx.fillRect(x+margin+2,y+7,60-margin*2,46);
   ctx.fillStyle='rgba(13,27,33,.33)';ctx.fillRect(x+31,y+7,2,46);ctx.fillStyle='rgba(210,223,225,.18)';ctx.fillRect(x+margin,y+5,64-margin*2,2);
   if(rand()>.4){ctx.fillStyle='rgba(26,36,43,.27)';ctx.fillRect(x+margin+2,y+7,60-margin*2,rand()*35)}
   ctx.fillStyle=brick?'#aca495':'#a0aeb1';ctx.fillRect(x,y+59,64,brick?5:3);
   if(lit){ec.fillStyle=['#c4b085','#8c927d','#c9a476'][Math.floor(rand()*3)];ec.fillRect(x+margin+2,y+7,60-margin*2,46)}
  }
  const image=ctx.getImageData(0,0,512,1024);for(let i=0;i<image.data.length;i+=4){let d=(rand()-.5)*9;image.data[i]+=d;image.data[i+1]+=d;image.data[i+2]+=d}ctx.putImageData(image,0,0);
  const map=new T.CanvasTexture(c),em=new T.CanvasTexture(e);map.colorSpace=em.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=em.wrapS=em.wrapT=T.RepeatWrapping;map.anisotropy=8;
  return new T.MeshStandardMaterial({map,emissiveMap:em,emissive:0xffeac5,emissiveIntensity:.18,metalness:brick?.1:.42,roughness:brick?.88:.3});
 }
 setNight(n:number){this.facades.forEach(m=>m.emissiveIntensity=.12+n*.8)}
}
export function label(text:string,w=512,h=128,color='#f1eee2',bg='#14282a',size=54){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=color;ctx.font=`600 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w-28);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
export function mesh(geo:T.BufferGeometry,mat:T.Material,parent:T.Object3D,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
export function box(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){return mesh(new T.BoxGeometry(w,h,d),mat,parent,x,y,z)}
export function beam(parent:T.Object3D,mat:T.Material,a:T.Vector3,b:T.Vector3,r=.12,segments=8){const d=b.clone().sub(a);const m=mesh(new T.CylinderGeometry(r,r,d.length(),segments),mat,parent,...a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m}
