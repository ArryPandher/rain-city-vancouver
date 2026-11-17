/** Deterministic lower-envelope fit on a finite height graph. Source heights are
 * soft targets; zero-edge pad groups and local grade bounds are hard constraints.
 * A fixed abutment's lower cone prevents the fit simply lowering the bridge. */
export function fitSouthGradeField(options:{
  heights:Float32Array;columns:number;rows:number;step:number;
  edges:{a:number;b:number;limit:number}[];anchors:{id:number;height:number}[];
}){
  const {columns,rows,step}=options,n=columns*rows;
  const extra=new Map<number,{id:number;cost:number}[]>();
  for(const e of options.edges){if(e.a===e.b)continue;for(const [a,b] of[[e.a,e.b],[e.b,e.a]]){
    if(!extra.has(a))extra.set(a,[]);extra.get(a)!.push({id:b,cost:e.limit});
  }}
  const adjacent=(id:number,fn:(j:number,cost:number)=>void)=>{
    const x=id%columns,z=Math.floor(id/columns);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if((dx||dz)&&x+dx>=0&&x+dx<columns&&z+dz>=0&&z+dz<rows)
      fn(id+dz*columns+dx,step*.45*Math.hypot(dx,dz));
    for(const e of extra.get(id)??[])fn(e.id,e.cost);
  };
  const solve=(initial:Float64Array)=>{
    const out=initial.slice(),heap:{id:number;y:number}[]=[];
    const push=(id:number,y:number)=>{let i=heap.length;heap.push({id,y});while(i){const p=(i-1)>>1;if(heap[p].y<=y)break;heap[i]=heap[p];i=p;}heap[i]={id,y};};
    const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].y<heap[j].y)j++;if(heap[j].y>=last.y)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
    for(let i=0;i<n;i++)if(Number.isFinite(out[i]))push(i,out[i]);
    while(heap.length){const p=pop();if(p.y>out[p.id]+1e-9)continue;adjacent(p.id,(id,cost)=>{const y=p.y+cost;if(y<out[id]-1e-9){out[id]=y;push(id,y);}});}
    return out;
  };
  const lowerSeed=new Float64Array(n).fill(Infinity);
  for(const a of options.anchors)lowerSeed[a.id]=-a.height;
  const negativeLower=solve(lowerSeed),target=Float64Array.from(options.heights,(h,i)=>Math.max(h,-negativeLower[i],0));
  for(const a of options.anchors)target[a.id]=a.height;
  const fit=solve(target);
  return Float32Array.from(fit);
}
