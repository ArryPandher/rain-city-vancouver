import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mesh,box,Materials,beam} from '../world/materials';
export interface Character {group:T.Group;hips:T.Group;arms:T.Group[];legs:T.Group[];head:T.Group;rightHand:T.Group;update:(t:number,speed:number,aim:boolean,bike?:boolean)=>void}
export function makeCharacter(m:Materials,variant=0):Character{
 const group=new T.Group(),hips=new T.Group();hips.position.y=.94;group.add(hips);const skin=new T.MeshStandardMaterial({color:[0xb58b6e,0x825e49,0xc2a68a,0x72523f][variant%4],roughness:.82});const shirt=new T.MeshStandardMaterial({color:[0x3f514c,0x6a7274,0x674b3d,0x303d52,0x897866][variant%5],roughness:.9});const denim=new T.MeshStandardMaterial({color:variant===0?0x394750:0x364046,roughness:.95});const shoe=new T.MeshStandardMaterial({color:0x25282a,roughness:.8});const hair=new T.MeshStandardMaterial({color:0x382c25,roughness:1});
 mesh(new RoundedBoxGeometry(.34,.21,.24,3,.06),denim,hips,0,0,0);
 const torso=mesh(new T.CapsuleGeometry(.19,.25,5,12),shirt,hips,0,.27,0);torso.scale.set(1.12,1,.74);
 box(hips,new T.MeshStandardMaterial({color:0x1a2427,roughness:.8}),0,.045,.035,.35,.055,.25);box(hips,m.chrome,0,.045,.167,.052,.045,.012);
 // Neck, sculpted head, eyes, ears, brows, short hair and nose.
 mesh(new T.CylinderGeometry(.052,.059,.11,12),skin,hips,0,.58,0);const head=new T.Group();head.position.set(0,.72,0);hips.add(head);const skull=mesh(new T.SphereGeometry(.105,20,16),skin,head,0,0,0);skull.scale.set(.9,1.3,.94);const jaw=mesh(new RoundedBoxGeometry(.14,.1,.14,3,.04),skin,head,0,-.075,.016);mesh(new T.SphereGeometry(.017,8,8),skin,head,0,-.007,.101);for(const x of [-.091,.091]){const ear=mesh(new T.SphereGeometry(.023,8,8),skin,head,x,-.016,0);ear.scale.y=1.35}const top=mesh(new T.SphereGeometry(.107,16,10,0,Math.PI*2,0,1.65),hair,head,0,.014,-.006);top.scale.set(.93,1.3,.94);for(const x of [-.038,.038]){box(head,hair,x,.025,.087,.03,.009,.008);const eye=mesh(new T.SphereGeometry(.007,8,8),m.dark,head,x,.008,.096);eye.scale.x=1.5}box(head,hair,0,-.052,.096,.045,.009,.008);
 const arms:T.Group[]=[],legs:T.Group[]=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.226,.44,0);hips.add(arm);arms.push(arm);const shoulder=mesh(new T.CapsuleGeometry(.067,.10,4,10),shirt,arm,side*.015,-.078,0);const upper=mesh(new T.CapsuleGeometry(.052,.15,4,10),skin,arm,side*.015,-.19,0);const fore=mesh(new T.CapsuleGeometry(.043,.17,4,10),skin,arm,side*.015,-.39,.025);const hand=mesh(new T.SphereGeometry(.047,10,8),skin,arm,side*.015,-.53,.04);hand.scale.set(.72,1.2,.9);
  const leg=new T.Group();leg.position.set(side*.097,-.10,0);hips.add(leg);legs.push(leg);mesh(new T.CapsuleGeometry(.075,.24,4,10),denim,leg,0,-.18,0);mesh(new T.CapsuleGeometry(.059,.24,4,10),denim,leg,0,-.52,0);const foot=mesh(new RoundedBoxGeometry(.14,.105,.29,3,.03),shoe,leg,0,-.775,.055);box(leg,m.dark,0,-.814,.05,.14,.023,.29);
 }
 const rightHand=new T.Group();rightHand.position.set(.015,-.49,.07);arms[1].add(rightHand);
 const update=(t:number,speed:number,aim:boolean,bike=false)=>{const moving=Math.min(1,speed/2),run=speed>4;const phase=t*(run?11:7.5);hips.position.y=.94+Math.sin(phase*2)*.026*moving;legs[0].rotation.x=Math.sin(phase)*(run?.72:.5)*moving;legs[1].rotation.x=-legs[0].rotation.x;arms[0].rotation.x=-legs[0].rotation.x*.8;arms[1].rotation.x=-legs[1].rotation.x*.8;arms.forEach((a,i)=>a.rotation.z=(i===0?.09:-.09));if(aim){arms[1].rotation.x=-1.58;arms[0].rotation.x=-1.35;arms[0].rotation.z=-.42;arms[1].rotation.z=.05}if(bike){hips.position.y=1.14;hips.rotation.x=.27;legs[0].rotation.x=.9+Math.sin(phase)*.45;legs[1].rotation.x=.9-Math.sin(phase)*.45;arms[0].rotation.x=arms[1].rotation.x=-.9}else hips.rotation.x=0};
 return {group,hips,arms,legs,head,rightHand,update};
}
export function makeWeapon(m:Materials,type:number){const g=new T.Group();const steel=new T.MeshStandardMaterial({color:0x202a30,metalness:.7,roughness:.31}),grip=new T.MeshStandardMaterial({color:type===2?0x624b36:0x293238,roughness:.78});const len=type===0?.24:type===1?.68:.82;
 box(g,steel,0,0,len*.22,.055,.06,len*.65);box(g,grip,0,-.075,0,.045,.13,.065);const barrel=mesh(new T.CylinderGeometry(type===2?.017:.012,type===2?.019:.014,len*.48,12),steel,g,0,0,len*.72);barrel.rotation.x=Math.PI/2;
 if(type>0){box(g,grip,0,-.032,-.16,.07,.11,.26);box(g,grip,0,-.04,.24,.073,.07,.22);box(g,steel,0,-.13,.105,.038,.16,.07);box(g,m.dark,0,.063,.14,.03,.03,.16)}else{box(g,m.chrome,0,.04,.04,.025,.01,.09)}
 const trigger=new T.TorusGeometry(.024,.004,5,10,Math.PI*1.6);const t=mesh(trigger,steel,g,0,-.055,.068);t.rotation.y=Math.PI/2;g.rotation.x=Math.PI/2;return g;
}
