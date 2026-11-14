export interface CarState {x:number;z:number;heading:number;speed:number;steer:number;vx:number;vz:number;travel:number}
export interface DriveInput {throttle:number;steering:number;brake:boolean;boost:boolean}
export const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const damp=(a:number,b:number,lambda:number,dt:number)=>a+(b-a)*(1-Math.exp(-lambda*dt));
export function drive(s:CarState,input:DriveInput,dt:number,bike=false){
 const top=bike?13.8:input.boost?63:46,maxReverse=bike?3:10;
 const acceleration=bike?5.2:input.boost?15:10;const rolling=bike?.25:.75;const aero=bike?.024:.0038;
 if(input.throttle!==0){if(Math.sign(input.throttle)!==Math.sign(s.speed)&&Math.abs(s.speed)>.6)s.speed+=input.throttle*(bike?12:24)*dt;else s.speed+=input.throttle*acceleration*(1-Math.min(.96,Math.abs(s.speed)/(input.throttle>0?top:maxReverse)))*dt}else s.speed=damp(s.speed,0,rolling/(Math.abs(s.speed)+1)+aero*Math.abs(s.speed),dt);
 if(input.brake)s.speed=damp(s.speed,0,bike?5:3.2,dt);
 s.speed=Math.max(-maxReverse,Math.min(top,s.speed));if(Math.abs(s.speed)<.025)s.speed=0;
 const maxSteer=(bike?.52:.53)/(1+Math.abs(s.speed)*(bike?.03:.046));s.steer=damp(s.steer,input.steering*maxSteer,7,dt);
 s.heading+=Math.tan(s.steer)*s.speed/(bike?1.42:2.95)*dt;
 const targetX=Math.sin(s.heading)*s.speed,targetZ=Math.cos(s.heading)*s.speed;
 const grip=input.brake&&!bike?2.2:bike?15:9;s.vx=damp(s.vx,targetX,grip,dt);s.vz=damp(s.vz,targetZ,grip,dt);
 s.x+=s.vx*dt;s.z+=s.vz*dt;s.travel+=Math.abs(s.speed)*dt;return s;
}
export function carState(x:number,z:number,heading=0):CarState{return {x,z,heading,speed:0,steer:0,vx:0,vz:0,travel:0}}
