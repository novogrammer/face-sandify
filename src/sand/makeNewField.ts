import { clamp, dot, Fn, int, vec2, length, If, min, float, Loop } from "three/tsl";
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

const makeNewFieldClassic=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // 既存の斜めライン + 左右のシンク
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
  name:"makeNewFieldClassic",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});
const makeNewFieldBucket=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // バケツ
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
  name:"makeNewFieldBucket",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});

const makeNewFieldHourglass=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // 砂時計
  Loop(2,({i})=>{
    const mirroredUv = uv.toVar("uv2");
    If(i.notEqual(int(0)),()=>{
      mirroredUv.assign(vec2(uv.x.oneMinus(),uv.y));
    });
    If(min(
      distPointSegment(mirroredUv,vec2(0.2,1.0),vec2(0.2,0.6)),
      distPointSegment(mirroredUv,vec2(0.2,0.6),vec2(0.49,0.4)),
      distPointSegment(mirroredUv,vec2(0.49,0.4),vec2(0.49,0.35)),
      distPointSegment(mirroredUv,vec2(0.49,0.35),vec2(0.2,0.15)),
      distPointSegment(mirroredUv,vec2(0.2,0.15),vec2(0.2,0.0)),
      distPointSegment(mirroredUv,vec2(0.3,0.01),vec2(0.5,0.01)),
      
    ).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });

  });
  return kindNew;
}).setLayout({
  name:"makeNewFieldHourglass",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});

const makeNewFieldSieve=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // 篩（ふるい）
  Loop(11,({i})=>{
    const offset = vec2(0.1,0).mul(float(i));
    If(distPointSegment(uv,vec2(-0.05,0.2).add(offset),vec2(0.05,0.1).add(offset)).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });

  });
  return kindNew;
}).setLayout({
  name:"makeNewFieldSieve",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});

export const makeNewField=Fn(([uv,fieldIndex]:[ReturnType<typeof vec2>,ReturnType<typeof float>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  If(fieldIndex.equal(int(0)),()=>{
    kindNew.assign(makeNewFieldClassic(uv));
  }).ElseIf(fieldIndex.equal(int(1)),()=>{
    kindNew.assign(makeNewFieldSieve(uv));
  }).ElseIf(fieldIndex.equal(int(2)),()=>{
    kindNew.assign(makeNewFieldHourglass(uv));
  }).ElseIf(fieldIndex.equal(int(3)),()=>{
    kindNew.assign(makeNewFieldBucket(uv));
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
      name:"fieldIndex",
      type:"int",
    },
  ],

});