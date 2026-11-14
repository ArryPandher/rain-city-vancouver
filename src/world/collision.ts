import { CityData, Building, bounds, centroid, pointInPoly, segmentPoint, geo, Road, roadWidth } from './data';
export interface Bridge {id:string;name:string;a:[number,number];b:[number,number];width:number;height:number;style:'concrete'|'suspension'|'truss'}
export const BRIDGES:Bridge[]=[
 {id:'cambie',name:'Cambie Bridge',a:geo(49.2765,-123.11498),b:geo(49.2689,-123.11413),width:24,height:17,style:'concrete'},
 {id:'granville',name:'Granville Bridge',a:geo(49.2763,-123.1291),b:geo(49.269,-123.1381),width:28,height:22,style:'truss'},
 {id:'burrard',name:'Burrard Bridge',a:geo(49.2771,-123.1334),b:geo(49.2729,-123.144),width:23,height:21,style:'concrete'},
 {id:'lions',name:'Lions Gate Bridge',a:geo(49.3125,-123.14186),b:geo(49.3276,-123.13645),width:22,height:42,style:'suspension'},
 {id:'ironworkers',name:'Ironworkers Memorial Bridge',a:geo(49.2941,-123.0236),b:geo(49.3153,-123.0286),width:29,height:39,style:'truss'}
];
export const bridgeY=(b:Bridge,t:number)=>Math.pow(Math.sin(Math.PI*t),1.1)*b.height;
export class SpatialHash<T>{cells=new Map<string,T[]>();constructor(public size=64){}add(v:T,minX:number,minZ:number,maxX=minX,maxZ=minZ){for(let x=Math.floor(minX/this.size);x<=Math.floor(maxX/this.size);x++)for(let z=Math.floor(minZ/this.size);z<=Math.floor(maxZ/this.size);z++){const k=x+','+z;let a=this.cells.get(k);if(!a)this.cells.set(k,a=[]);a.push(v)}}query(x:number,z:number,r=0){const out=new Set<T>();for(let ix=Math.floor((x-r)/this.size);ix<=Math.floor((x+r)/this.size);ix++)for(let iz=Math.floor((z-r)/this.size);iz<=Math.floor((z+r)/this.size);iz++)for(const v of this.cells.get(ix+','+iz)||[])out.add(v);return [...out]}}
export class CollisionWorld {
 buildings=new SpatialHash<Building>();roads=new SpatialHash<Road>(100);
 constructor(public data:CityData){for(const b of data.buildings){const xs=b.pts.filter((_,i)=>!(i%2)),zs=b.pts.filter((_,i)=>i%2);this.buildings.add(b,Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs))}for(const r of data.roads){for(let i=0;i<r.pts.length-2;i+=2)this.roads.add(r,Math.min(r.pts[i],r.pts[i+2]),Math.min(r.pts[i+1],r.pts[i+3]),Math.max(r.pts[i],r.pts[i+2]),Math.max(r.pts[i+1],r.pts[i+3]))}}
 bridgeAt(x:number,z:number){for(const b of BRIDGES){const s=segmentPoint(x,z,...b.a,...b.b);if(s.d<b.width*.52)return {bridge:b,...s}}return null}
 height(x:number,z:number){const b=this.bridgeAt(x,z);return b?bridgeY(b.bridge,b.t):0}
 water(x:number,z:number){if(this.bridgeAt(x,z))return false;if(x>bounds.maxX){const [n,s]=[geo(49.313,-123.09)[1],geo(49.294,-123.09)[1]];return z>n&&z<s}if(z<bounds.minZ)return true;return this.data.ocean.some(p=>pointInPoly(x,z,p))||this.data.areas.some(a=>a.kind==='water'&&pointInPoly(x,z,a.pts))}
 blocked(x:number,z:number,r=.4){if(this.height(x,z)>2)return false;for(const b of this.buildings.query(x,z,r)){if(pointInPoly(x,z,b.pts))return true;for(let i=0;i<b.pts.length;i+=2){const j=(i+2)%b.pts.length;if(segmentPoint(x,z,b.pts[i],b.pts[i+1],b.pts[j],b.pts[j+1]).d<r)return true}}return false}
 nearestRoad(x:number,z:number,max=90){let best:{x:number;z:number;t:number;d:number;heading:number;road:Road}|null=null;for(const r of this.roads.query(x,z,max)){if(!['primary','secondary','tertiary','residential','unclassified','cycleway','pedestrian'].includes(r.kind))continue;for(let i=0;i<r.pts.length-2;i+=2){const s=segmentPoint(x,z,r.pts[i],r.pts[i+1],r.pts[i+2],r.pts[i+3]);if(s.d<max&&(!best||s.d<best.d))best={...s,heading:Math.atan2(r.pts[i+2]-r.pts[i],r.pts[i+3]-r.pts[i+1]),road:r}}}return best}
 safe(x:number,z:number,r=.5){if(!this.blocked(x,z,r)&&!this.water(x,z))return [x,z] as [number,number];const p=this.nearestRoad(x,z,180);if(p&&!this.blocked(p.x,p.z,r))return [p.x,p.z] as [number,number];for(let d=3;d<90;d+=4)for(let a=0;a<Math.PI*2;a+=.4){const nx=x+Math.sin(a)*d,nz=z+Math.cos(a)*d;if(!this.blocked(nx,nz,r)&&!this.water(nx,nz))return [nx,nz] as [number,number]}return [x,z] as [number,number]}
 move(x:number,z:number,dx:number,dz:number,r:number){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.max(.2,r*.6)));let hit=false;for(let i=0;i<steps;i++){const nx=x+dx/steps,nz=z+dz/steps;if(!this.blocked(nx,nz,r)){x=nx;z=nz}else{hit=true;if(!this.blocked(nx,z,r))x=nx;if(!this.blocked(x,nz,r))z=nz}}return {x,z,hit}}
}
