/** UNINSTALLED WORK-IN-PROGRESS CHECKPOINT — 2026-11-16.
 * Preserved during the filming wrap-up, not release-ready or native-reviewed.
 * No World/road/building consumer imports this candidate. Exact coast clipping,
 * shared road/pad triangulation and the bridge approach join remain unresolved;
 * source heights and fitted grades require independent validation before use.
 */
import * as T from "three";
import { fitSouthGradeField } from "./ironworkers-south-grade-fit";
import pc, { type Ring } from "polygon-clipping";
import { pointInPoly, roadWidth, segmentPoint, type CityData, type Point } from "./data";
import source from "./ironworkers-south-terrain-source.json";

/** Disconnected source-core candidate. Outer blending adapts to the flat city;
 * it is explicitly not terrain survey. Install ground, road and pad contact
 * together only after the approach profile has passed the grade audit. */
export const IRONWORKERS_SOUTH_CORE: Point[] = [
  [6630,-1020],[6810,-1110],[7020,-1080],[7070,-1010],[7020,-930],
  [6910,-930],[6850,-885],[6790,-790],[6670,-620],[6500,-430],
  [6420,-480],[6530,-720],[6630,-920],
];
export const IRONWORKERS_SOUTH_TERRAIN = { transition: 250, grid: 4, maxRoadGrade: .08 } as const;
const coreFlat = IRONWORKERS_SOUTH_CORE.flat();
const smooth = (t:number) => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function southCoreDistance(x:number,z:number) {
  if(pointInPoly(x,z,coreFlat))return 0;
  let d=Infinity;
  for(let i=0;i<IRONWORKERS_SOUTH_CORE.length;i++){
    const a=IRONWORKERS_SOUTH_CORE[i],b=IRONWORKERS_SOUTH_CORE[(i+1)%IRONWORKERS_SOUTH_CORE.length];
    d=Math.min(d,segmentPoint(x,z,...a,...b).d);
  }
  return d;
}
export function southSourceHeight(x:number,z:number) {
  const u=(x-source.minX)/source.step,v=(z-source.minZ)/source.step;
  if(u<0||v<0||u>source.columns-1||v>source.rows-1)return undefined;
  const ix=Math.min(source.columns-2,Math.floor(u)),iz=Math.min(source.rows-2,Math.floor(v));
  const a=u-ix,b=v-iz,i=iz*source.columns+ix,h=source.elevations;
  return (h[i]*(1-a)+h[i+1]*a)*(1-b)+(h[i+source.columns]*(1-a)+h[i+source.columns+1]*a)*b;
}
type Pad={id:string;pts:number[];height:number;minX:number;minZ:number;maxX:number;maxZ:number};
type RoadPiece={limit:number;id:string;ax:number;az:number;bx:number;bz:number;length:number;width:number;a:number;b:number};

export function createIronworkersSouthTerrainCandidate(data:Pick<CityData,"roads"|"buildings"|"ocean"|"areas">) {
  const d=IRONWORKERS_SOUTH_TERRAIN, step=d.grid;
  const box={minX:Math.floor((6420-d.transition)/step)*step,maxX:Math.ceil((7070+d.transition)/step)*step,
    minZ:Math.floor((-1110-d.transition)/step)*step,maxZ:Math.ceil((-430+d.transition)/step)*step};
  const inBox=(p:number[])=>Math.max(...p.filter((_,i)=>!(i%2)))>=box.minX&&Math.min(...p.filter((_,i)=>!(i%2)))<=box.maxX&&Math.max(...p.filter((_,i)=>i%2))>=box.minZ&&Math.min(...p.filter((_,i)=>i%2))<=box.maxZ;
  const study:Ring=[[box.minX,box.minZ],[box.maxX,box.minZ],[box.maxX,box.maxZ],[box.minX,box.maxZ],[box.minX,box.minZ]];
  const waters=[...data.ocean,...data.areas.filter(a=>a.kind==="water").map(a=>a.pts)].filter(inBox).flatMap(p=>pc.intersection([study],[Array.from({length:p.length/2},(_,i)=>[p[2*i],p[2*i+1]] as Point)]).flat().map(r=>r.flat()));
  const shoreDistance=(x:number,z:number)=>{let d=Infinity;for(const p of waters)for(let i=2;i<p.length;i+=2)d=Math.min(d,segmentPoint(x,z,p[i-2],p[i-1],p[i],p[i+1]).d);return d;};
  const water=(x:number,z:number)=>waters.some(p=>pointInPoly(x,z,p));
  const base=(x:number,z:number)=>water(x,z)?0:Math.min(shoreDistance(x,z)*.6,Math.max(0,southSourceHeight(x,z)??0)*(1-smooth(southCoreDistance(x,z)/d.transition)));
  const pads:Pad[]=data.buildings.filter(b=>inBox(b.pts)).flatMap(b=>{
    const xs=b.pts.filter((_,i)=>!(i%2)),zs=b.pts.filter((_,i)=>i%2),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const height=base((minX+maxX)/2,(minZ+maxZ)/2);
    return height>.02?[{id:b.id,pts:b.pts,height,minX,minZ,maxX,maxZ}]:[];
  });
  const roadPieces:RoadPiece[]=[];
  for(const r of data.roads){
    if(!inBox(r.pts)||r.name?.includes("Ironworkers Memorial"))continue;
    for(let i=2;i<r.pts.length;i+=2){
      const ax=r.pts[i-2],az=r.pts[i-1],bx=r.pts[i],bz=r.pts[i+1],length=Math.hypot(bx-ax,bz-az);
      if(!length)continue;
      const a=base(ax,az),b=base(bx,bz);
      if(Math.max(a,b,base((ax+bx)/2,(az+bz)/2))<.02)continue;
      roadPieces.push({limit:["primary","secondary","tertiary"].includes(r.kind)?.08:["residential","service","unclassified"].includes(r.kind)?.15:.35,id:r.id??"",ax,az,bx,bz,length,width:roadWidth(r)/2,a,b});
    }
  }
  // Shared OSM endpoints form one grade graph. Alternating metric projections
  // fit coarse source targets to finite drive/walk grade limits; source road XZ
  // vertices are never moved. Fixed bridge join is a separate source control.
  type Node={x:number;z:number;y:number;fixed:boolean};
  const nodes=new Map<string,Node>();
  const node=(x:number,z:number)=>{const key=`${x},${z}`;if(!nodes.has(key)){
    const abutment=Math.hypot(x-6815.1,z+951.9)<.2||Math.hypot(x-6804.4,z+952.7)<.2;
    const y=base(x,z);nodes.set(key,{x,z,y:abutment?46.51:y,fixed:abutment||southCoreDistance(x,z)>=d.transition});
  }return nodes.get(key)!;};
  const edges=roadPieces.map(r=>({r,a:node(r.ax,r.az),b:node(r.bx,r.bz)}));
  for(let iteration=0;iteration<1200;iteration++){
    let worst=0;
    for(const {r,a,b} of edges){const delta=b.y-a.y,excess=Math.abs(delta)-r.limit*r.length;if(excess<=1e-5)continue;
      worst=Math.max(worst,excess);const sign=Math.sign(delta);
      if(!a.fixed&&!b.fixed){a.y+=sign*excess/2;b.y-=sign*excess/2;}
      else if(!a.fixed)a.y+=sign*excess;else if(!b.fixed)b.y-=sign*excess;
    }
    if(worst<1e-4)break;
  }
  for(const {r,a,b} of edges){r.a=a.y;r.b=b.y;}
  // Pad datum follows the nearest fitted street where its source hillside has
  // needed a cut; pads must not hang above an adjusted access street.
  for(const p of pads){const x=(p.minX+p.maxX)/2,z=(p.minZ+p.maxZ)/2;let best=Infinity,h=p.height;
    for(const r of roadPieces){const q=segmentPoint(x,z,r.ax,r.az,r.bx,r.bz);if(q.d<best){best=q.d;const t=Math.max(0,Math.min(1,((x-r.ax)*(r.bx-r.ax)+(z-r.az)*(r.bz-r.az))/r.length**2));h=r.a+(r.b-r.a)*t;}}
    if(best<35)p.height=h;
  }
  const bins=new Map<string,{roads:RoadPiece[];pads:Pad[]}>();
  const add=(minX:number,minZ:number,maxX:number,maxZ:number,kind:"roads"|"pads",item:RoadPiece|Pad)=>{
    for(let x=Math.floor(minX/32);x<=Math.floor(maxX/32);x++)for(let z=Math.floor(minZ/32);z<=Math.floor(maxZ/32);z++){
      const key=`${x},${z}`;if(!bins.has(key))bins.set(key,{roads:[],pads:[]});
      (bins.get(key)![kind] as (RoadPiece|Pad)[]).push(item);
    }
  };
  for(const r of roadPieces)add(Math.min(r.ax,r.bx)-r.width-12,Math.min(r.az,r.bz)-r.width-12,Math.max(r.ax,r.bx)+r.width+12,Math.max(r.az,r.bz)+r.width+12,"roads",r);
  for(const p of pads)add(p.minX-12,p.minZ-12,p.maxX+12,p.maxZ+12,"pads",p);
  const field=(x:number,z:number)=>{
    let y=base(x,z);if(water(x,z))return 0;
    const bin=bins.get(`${Math.floor(x/32)},${Math.floor(z/32)}`);
    if(!bin)return y;
    for(const p of bin.pads){const distance=Math.hypot(Math.max(p.minX-x,0,x-p.maxX),Math.max(p.minZ-z,0,z-p.maxZ));
      if(distance<12)y=p.height+(y-p.height)*smooth(distance/12);
    }
    let best=Infinity;
    for(const r of bin.roads){
      const q=segmentPoint(x,z,r.ax,r.az,r.bx,r.bz),distance=Math.max(0,q.d-r.width);
      if(distance>=12||distance>=best)continue;best=distance;
      const t=Math.max(0,Math.min(1,((x-r.ax)*(r.bx-r.ax)+(z-r.az)*(r.bz-r.az))/r.length**2));
      const h=r.a+(r.b-r.a)*t;
      y=h+(y-h)*smooth(distance/12);
    }
    return Math.min(shoreDistance(x,z)*.6,Math.max(0,y));
  };
  const columns=Math.round((box.maxX-box.minX)/step)+1,rows=Math.round((box.maxZ-box.minZ)/step)+1;
  let heights=new Float32Array(columns*rows);
  for(let z=0;z<rows;z++)for(let x=0;x<columns;x++)heights[z*columns+x]=field(box.minX+x*step,box.minZ+z*step);
  const gridId=(x:number,z:number)=>Math.max(0,Math.min(rows-1,Math.round((z-box.minZ)/step)))*columns+Math.max(0,Math.min(columns-1,Math.round((x-box.minX)/step)));
  const gridEdges:{a:number;b:number;limit:number}[]=[];
  for(const p of pads){const a=gridId((p.minX+p.maxX)/2,(p.minZ+p.maxZ)/2);
    for(let z=Math.floor((p.minZ-box.minZ)/step)-1;z<=Math.ceil((p.maxZ-box.minZ)/step)+1;z++)
      for(let x=Math.floor((p.minX-box.minX)/step)-1;x<=Math.ceil((p.maxX-box.minX)/step)+1;x++)
        if(x>=0&&x<columns&&z>=0&&z<rows)gridEdges.push({a,b:z*columns+x,limit:0});
  }
  for(const r of roadPieces){const count=Math.ceil(r.length/step);let last=gridId(r.ax,r.az);
    for(let k=1;k<=count;k++){const t=k/count,id=gridId(r.ax+(r.bx-r.ax)*t,r.az+(r.bz-r.az)*t);
      gridEdges.push({a:last,b:id,limit:r.limit*r.length/count});last=id;
    }
  }
  heights=fitSouthGradeField({heights,columns,rows,step,edges:gridEdges,anchors:[{id:gridId(6810,-952),height:46.51}]});
  for(const p of pads)p.height=heights[gridId((p.minX+p.maxX)/2,(p.minZ+p.maxZ)/2)];
  const sample=(x:number,z:number)=>{
    const u=(x-box.minX)/step,v=(z-box.minZ)/step;if(u<0||v<0||u>columns-1||v>rows-1)return undefined;
    const ix=Math.min(columns-2,Math.floor(u)),iz=Math.min(rows-2,Math.floor(v)),a=u-ix,b=v-iz,i=iz*columns+ix;
    return a+b<=1?heights[i]+(heights[i+1]-heights[i])*a+(heights[i+columns]-heights[i])*b:
      heights[i+columns+1]+(heights[i+columns]-heights[i+columns+1])*(1-a)+(heights[i+1]-heights[i+columns+1])*(1-b);
  };
  // The prototype includes only land triangles. Exact coastal clipping replaces
  // this conservative omission before installation; it cannot fill navigation water.
  const positions:number[]=[],uv:number[]=[];let maxSlope=0;
  const emit=(ids:number[])=>{
    const p=ids.map(i=>[box.minX+(i%columns)*step,heights[i],box.minZ+Math.floor(i/columns)*step] as[number,number,number]);
    if(Math.max(...p.map(v=>v[1]))<.001||p.some(v=>water(v[0],v[2]))||water((p[0][0]+p[1][0]+p[2][0])/3,(p[0][2]+p[1][2]+p[2][2])/3))return;
    const n=new T.Vector3(...p[1]).sub(new T.Vector3(...p[0])).cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if(n.y<0)[p[1],p[2]]=[p[2],p[1]];
    maxSlope=Math.max(maxSlope,Math.atan2(Math.hypot(n.x,n.z),Math.abs(n.y))*180/Math.PI);
    for(const v of p){positions.push(...v);uv.push(v[0],v[2]);}
  };
  for(let z=0;z<rows-1;z++)for(let x=0;x<columns-1;x++){const i=z*columns+x;emit([i,i+columns,i+1]);emit([i+1,i+columns,i+columns+1]);}
  const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingBox();
  const roadGradeConflicts=roadPieces.filter(r=>Math.abs(r.b-r.a)/r.length>r.limit+.00001).map(r=>({id:r.id,grade:Math.abs(r.b-r.a)/r.length,limit:r.limit,ends:[[r.ax,r.a,r.az],[r.bx,r.b,r.bz]]}));
  return {geometry,sample,source:base,field,pads,roadPieces,box,heights,columns,rows,
    stats:{triangles:positions.length/9,buildings:pads.length,roads:new Set(roadPieces.map(r=>r.id)).size,maxSlope},
    releaseReady:false as const,unresolved:{roadGradeConflicts,exactCoastClip:true,bridgeApproachJoin:true,roadAndPadTriangulation:true}};
}
