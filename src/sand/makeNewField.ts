import { clamp, dot, Fn, int, vec2, length, If, min, float } from "three/tsl";
import { KIND_AIR, KIND_SINK, KIND_WALL } from "./sand_types";

const distPointSegment=Fn(([p,a,b]:[ReturnType<typeof vec2>,ReturnType<typeof vec2>,ReturnType<typeof vec2>])=>{
  const pa = p.sub(a).toVar("pa");
  const ba = b.sub(a).toVar("ba");
  const t = clamp(dot(pa,ba).div(dot(ba,ba)),0.0,1.0).toVar("t");
  const proj = a.add(ba.mul(t)).toVar("proj");
  return length(p.sub(proj));
}).setLayout({
  name:"distPointSegment",
  type:"float",
  inputs:[
    {
      name:"p",
      type:"vec2",
    },
    {
      name:"a",
      type:"vec2",
    },
    {
      name:"b",
      type:"vec2",
    },
  ],
});

const makeNewFieldClassic=Fn(([uv,width]:[ReturnType<typeof vec2>,ReturnType<typeof int>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(3).div(width).toVar("thickness");
  // フィールド0: 既存の斜めライン + 左右のシンク
  {
    If(min(
      distPointSegment(uv,vec2(0.3,0.90),vec2(0.5,0.95)),
      distPointSegment(uv,vec2(0.7,0.90),vec2(0.5,0.95)),
      distPointSegment(uv,vec2(0.3,0.15),vec2(0.49,0.1)),
      distPointSegment(uv,vec2(0.7,0.15),vec2(0.51,0.1)),
      distPointSegment(uv,vec2(0.3,0.15),vec2(0.15,0.1)),
      distPointSegment(uv,vec2(0.7,0.15),vec2(0.85,0.1)),
    ).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });
  }
  {
    If(min(
      distPointSegment(uv,vec2(0.15,0.5),vec2(0,0.5)),
      distPointSegment(uv,vec2(0.85,0.5),vec2(1,0.5)),
    ).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_SINK);
    });
  }
  return kindNew;
}).setLayout({
  name:"makeNewFieldA",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
    {
      name:"width",
      type:"float",
    },
  ],
});
const makeNewFieldBucket=Fn(([uv,width]:[ReturnType<typeof vec2>,ReturnType<typeof int>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(3).div(width).toVar("thickness");
  // フィールド1: バケツ
  {
    If(min(
      // 下辺
      distPointSegment(uv,vec2(0.1,0.05),vec2(0.9,0.05)),
      // 左辺
      distPointSegment(uv,vec2(0.1,0.05),vec2(0.0,0.9)),
      // 右辺
      distPointSegment(uv,vec2(0.9,0.05),vec2(1.0,0.9)),
    ).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });
  }
  return kindNew;
}).setLayout({
  name:"makeNewFieldB",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
    {
      name:"width",
      type:"float",
    },
  ],
});

export const makeNewField=Fn(([uv,width,fieldIndex]:[ReturnType<typeof vec2>,ReturnType<typeof int>,ReturnType<typeof float>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  If(fieldIndex.equal(int(0)),()=>{
    kindNew.assign(makeNewFieldClassic(uv,width));
  }).ElseIf(fieldIndex.equal(int(1)),()=>{
    kindNew.assign(makeNewFieldBucket(uv,width));
  }).Else(()=>{
    // DO NOTHING
  });
  return kindNew;

}).setLayout({
  name:"makeNewField",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
    {
      name:"width",
      type:"float",
    },
    {
      name:"fieldIndex",
      type:"int",
    },
  ],

});