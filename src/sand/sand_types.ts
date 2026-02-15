import { bool, float, Fn, If, int, mix, struct, vec3, vec4 } from "three/tsl";

export const KIND_AIR=int(0);
export const KIND_SAND=int(1);
export const KIND_WALL=int(2);
export const KIND_SINK=int(3);

// Cell構造体の定義
export const Cell = struct({
    kind: 'int',
    luminance: 'float',
    ttl: 'float',
},"Cell");

export const isAirLikeCell=Fn(([cell]:[ReturnType<typeof Cell>])=>{
  const isAir=bool(cell.get("kind").equal(KIND_AIR))/*.toVar("isAir")*/;
  const isSink=bool(cell.get("kind").equal(KIND_SINK))/*.toVar("isSink")*/;
  return isAir.or(isSink);
}).setLayout({
  name:"isAirLikeCell",
  type:"bool",
  inputs:[
    {
      name:"cell",
      type:"Cell",
    },
  ],
});

export const toColor = Fn(([cell]:[ReturnType<typeof Cell>])=>{
  const rgb=vec3(1.0).toVar("rgb");
  const luminance=cell.get("luminance").toVar("luminance");
  If(cell.get("kind").equal(KIND_WALL),()=>{
    // rgb.assign(vec3(0.1,0.2,0.3));
    rgb.assign(vec3(0.3,0.3,0.3));
  }).ElseIf(cell.get("kind").equal(KIND_SAND),()=>{
    const intensity=float(2.5);
    rgb.assign(mix(vec3(0.75,0.05,0.0).mul(intensity),vec3(1.0,0.75,0.0).mul(intensity),luminance));
  }).ElseIf(cell.get("kind").equal(KIND_SINK),()=>{
    rgb.assign(vec3(1.0,0.0,0.0));
  }).Else(()=>{
    rgb.assign(vec3(0.0));
  })
  return vec4(rgb,1.0);
}).setLayout({
  name:"toColor",
  type:"vec4",
  inputs:[
    {
      name:"cell",
      type:"Cell",
    },
  ],
});
