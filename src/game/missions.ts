import * as T from 'three';
import { LANDMARKS, geo, Point } from '../world/data';
import { World } from '../world/world';
export interface Activity {id:string;name:string;checkpoints:{name:string;at:Point}[];index:number;elapsed:number}
export class Missions {
 active:Activity|null=null;marker:T.Group;light:T.Mesh;ring:T.Mesh;discovered=new Set<string>();distance=0;best:Record<string,number>={};
 constructor(public world:World,public announce:(t:string)=>void){this.marker=new T.Group();const mat=new T.MeshBasicMaterial({color:0xefb978,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});this.light=new T.Mesh(new T.CylinderGeometry(2.8,2.8,9,32,1,true),mat);this.light.position.y=4.5;this.ring=new T.Mesh(new T.TorusGeometry(3.1,.11,8,48),new T.MeshBasicMaterial({color:0xffc887}));this.ring.rotation.x=Math.PI/2;this.ring.position.y=.3;this.marker.add(this.light,this.ring);world.scene.add(this.marker);this.marker.visible=false;try{const s=JSON.parse(localStorage.getItem('rain-city-progress')||'{}');this.discovered=new Set(s.discovered||[]);this.distance=s.distance||0;this.best=s.best||{}}catch{}}
 start(id:string){if(id==='free'){this.active=null;this.marker.visible=false;this.announce('Free roam. Take the long way home.');return}const lookup=(id:string)=>{const l=LANDMARKS.find(l=>l.id===id)!;return {name:l.name,at:l.spawn}};const sets:Record<string,{name:string;checkpoints:{name:string;at:Point}[]}>= {
 harbour:{name:'Harbour run',checkpoints:['canada','gastown','robson','granville','english'].map(lookup)},
 seawall:{name:'Seawall escape',checkpoints:[lookup('stanley'),{name:'Brockton Point',at:geo(49.30063,-123.11736)},{name:'Lions Gate lookout',at:geo(49.31355,-123.13945)},{name:'Third Beach',at:geo(49.30324,-123.15802)},lookup('english')]},
 bridges:{name:'Bridge runner',checkpoints:[lookup('cambie'),lookup('science'),lookup('ironworkers'),lookup('prospect')]}
 };if(!sets[id])return;this.active={id,...sets[id],index:0,elapsed:0};this.moveMarker();this.announce(`${this.active.name}. Follow the amber waypoint.`)}
 moveMarker(){const a=this.active;if(!a){this.marker.visible=false;return}const c=a.checkpoints[a.index];this.marker.position.set(c.at[0],this.world.collision.height(...c.at),c.at[1]);this.marker.visible=true}
 update(dt:number,x:number,z:number,speed:number){this.distance+=Math.abs(speed)*dt;for(const l of LANDMARKS){if(!this.discovered.has(l.id)&&Math.hypot(x-l.at[0],z-l.at[1])<115){this.discovered.add(l.id);this.announce(`Discovered ${l.name} · ${this.discovered.size}/${LANDMARKS.length}`);this.save()}}
  const a=this.active;if(!a)return;a.elapsed+=dt;this.ring.rotation.z+=dt*.3;this.light.material instanceof T.MeshBasicMaterial&&(this.light.material.opacity=.22+Math.sin(a.elapsed*2)*.06);const c=a.checkpoints[a.index];if(Math.hypot(x-c.at[0],z-c.at[1])<38){a.index++;if(a.index>=a.checkpoints.length){const best=this.best[a.id];if(!best||a.elapsed<best)this.best[a.id]=a.elapsed;this.announce(`${a.name} complete · ${formatTime(a.elapsed)}${!best||a.elapsed<best?' · New best':''}`);this.active=null;this.save()}else this.announce(`Checkpoint ${a.index}/${a.checkpoints.length} · ${a.checkpoints[a.index].name}`);this.moveMarker()}}
 save(){try{localStorage.setItem('rain-city-progress',JSON.stringify({discovered:[...this.discovered],distance:this.distance,best:this.best}))}catch{}}
}
export const formatTime=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
