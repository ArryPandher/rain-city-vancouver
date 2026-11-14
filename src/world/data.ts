import { Vector2 } from 'three';
export type Point = [number, number];
export interface Road { name?: string; kind: string; pts: number[] }
export interface Area { name?: string; kind: string; pts: number[]; holes?: number[][] }
export interface Building { id: string; name?: string; kind?: string; levels?: number; pts: number[] }
export interface CityData { meta: { bbox:number[];latC:number;pxPerMeter:number;w:number;h:number;fetched:string }; roads:Road[];areas:Area[];buildings:Building[];trees:number[];ocean:number[][];pois:{name:string;kind:string;x:number;y:number}[] }
export const ORIGIN = {lat:49.283,lon:-123.12};
export const KX = Math.cos(49.2935*Math.PI/180)*111320;
export function geo(lat:number,lon:number):Point {return [(lon-ORIGIN.lon)*KX,(ORIGIN.lat-lat)*110540]}
export function ungeo(x:number,z:number):Point{return [ORIGIN.lat-z/110540,ORIGIN.lon+x/KX]}
export const bounds={minX:geo(49.3175,-123.164)[0],maxX:geo(49.2695,-123.0945)[0],minZ:geo(49.3175,-123.164)[1],maxZ:geo(49.2695,-123.0945)[1]};
export function pairs(pts:number[]):Point[]{const out:Point[]=[];for(let i=0;i<pts.length;i+=2)out.push([pts[i],pts[i+1]]);return out}
export function centroid(pts:number[]):Point{let x=0,z=0;for(let i=0;i<pts.length;i+=2){x+=pts[i];z+=pts[i+1]}return [x/(pts.length/2),z/(pts.length/2)]}
export function pointInPoly(x:number,z:number,p:number[]):boolean{let inside=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],zi=p[i+1],xj=p[j],zj=p[j+1];if(((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside}return inside}
export function segmentPoint(x:number,z:number,ax:number,az:number,bx:number,bz:number){const dx=bx-ax,dz=bz-az;const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return {x:ax+t*dx,z:az+t*dz,t,d:Math.hypot(x-ax-t*dx,z-az-t*dz)}}
export function seeded(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
export function hash(s:string){let n=0;for(const c of s)n=Math.imul(31,n)+c.charCodeAt(0)|0;return n>>>0}
export function vecs(p:number[]){return pairs(p).map(([x,z])=>new Vector2(x,-z))}
export async function loadCity():Promise<CityData>{
 const r=await fetch(`${import.meta.env.BASE_URL}data/vancouver.json`);if(!r.ok)throw new Error('Vancouver map could not be loaded. Reload to retry.');
 const d:CityData=await r.json();const ox=(ORIGIN.lon-d.meta.bbox[1])*KX,oz=(d.meta.bbox[2]-ORIGIN.lat)*110540;
 const convert=(p:number[])=>p.map((v,i)=>v/2-(i%2?oz:ox));
 d.roads.forEach(r=>r.pts=convert(r.pts));d.areas.forEach(a=>{a.pts=convert(a.pts);a.holes=a.holes?.map(convert)});d.buildings.forEach(b=>b.pts=convert(b.pts));d.trees=convert(d.trees);d.ocean=d.ocean.map(convert);d.pois.forEach(p=>{p.x=p.x/2-ox;p.y=p.y/2-oz});return d;
}
export const roadWidth=(r:Road)=>({primary:18,secondary:15,tertiary:13,residential:10,unclassified:10,service:6,pedestrian:8,cycleway:5,footway:4,path:3,track:4,steps:3}[r.kind]??8);
export const isStreet=(r:Road)=>['primary','secondary','tertiary','residential','unclassified'].includes(r.kind);
export interface Landmark {id:string;name:string;district:string;at:Point;spawn:Point;heading:number;description:string}
const lm=(id:string,name:string,district:string,at:Point,spawn:Point,heading:number,description:string):Landmark=>({id,name,district,at:geo(...at),spawn:geo(...spawn),heading,description});
export const LANDMARKS:Landmark[]=[
 lm('canada','Canada Place','Coal Harbour',[49.2886,-123.1116],[49.28710,-123.11415],-.38,'Five white sails, the working harbour and the North Shore beyond.'),
 lm('robson','Robson Square','Downtown',[49.2825,-123.1207],[49.28249,-123.12216],-.75,'Terraced gardens, the gallery and the heart of the city.'),
 lm('granville','Granville Street','Entertainment District',[49.27955,-123.1224],[49.27934,-123.1228],-.60,'The neon spine of downtown. Take a late-night cruise.'),
 lm('stanley','Stanley Park','Stanley Park',[49.300,-123.14],[49.29468,-123.1362],-.25,'A coastal forest, winding roads and kilometres of seawall.'),
 lm('prospect','Prospect Point','Stanley Park',[49.3125,-123.1420],[49.31176,-123.1429],-.3,'The Lions Gate crossing above the inlet.'),
 lm('english','English Bay','West End',[49.2868,-123.1428],[49.28705,-123.1407],2.35,'Sunset on the beach at the edge of the West End.'),
 lm('gastown','Gastown','Gastown',[49.2844,-123.1089],[49.28455,-123.1091],1.0,'Brick warehouses, Water Street and the steam clock.'),
 lm('cambie','Cambie Bridge','False Creek',[49.2738,-123.1144],[49.27645,-123.11483],3.0,'A long, open crossing with the city behind you.'),
 lm('science','Science World','False Creek',[49.2734,-123.1036],[49.27428,-123.1034],3.0,'The geodesic sphere at the head of False Creek.'),
 lm('ironworkers','Ironworkers Memorial Bridge','Burrard Inlet',[49.3025,-123.0265],[49.2941,-123.0236],-.12,'A steel truss crossing. Reach it along the eastern waterfront.'),
];
