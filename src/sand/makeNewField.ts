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

// const makeNewFieldClassic=Fn(([uv]:[ReturnType<typeof vec2>])=>{
//   const kindNew=KIND_AIR.toVar("kindNew");
//   const thickness=float(0.5*0.01).toVar("thickness");
//   // 既存の斜めライン + 左右のシンク
//   {
//     If(min(
//       distPointSegment(uv,vec2(0.3,0.90),vec2(0.5,0.95)),
//       distPointSegment(uv,vec2(0.7,0.90),vec2(0.5,0.95)),
//       distPointSegment(uv,vec2(0.3,0.15),vec2(0.49,0.1)),
//       distPointSegment(uv,vec2(0.7,0.15),vec2(0.51,0.1)),
//       distPointSegment(uv,vec2(0.3,0.15),vec2(0.15,0.1)),
//       distPointSegment(uv,vec2(0.7,0.15),vec2(0.85,0.1)),
//     ).lessThanEqual(thickness),()=>{
//       kindNew.assign(KIND_WALL);
//     });
//   }
//   {
//     If(min(
//       distPointSegment(uv,vec2(0.15,0.5),vec2(0,0.5)),
//       distPointSegment(uv,vec2(0.85,0.5),vec2(1,0.5)),
//     ).lessThanEqual(thickness),()=>{
//       kindNew.assign(KIND_SINK);
//     });
//   }
//   return kindNew;
// }).setLayout({
//   name:"makeNewFieldClassic",
//   type:"int",
//   inputs:[
//     {
//       name:"uv",
//       type:"vec2",
//     },
//   ],
// });
const makeNewFieldBucket=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // バケツ
  {
    If(min(
      // 下辺
      distPointSegment(uv,vec2(0.2,0.005),vec2(0.8,0.005)),
      // 左辺
      distPointSegment(uv,vec2(0.2,0.005),vec2(0.1,0.6)),
      // 右辺
      distPointSegment(uv,vec2(0.8,0.005),vec2(0.9,0.6)),
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
      distPointSegment(mirroredUv,vec2(0.2,0.75),vec2(0.2,0.6)),
      distPointSegment(mirroredUv,vec2(0.2,0.6),vec2(0.49,0.4)),
      distPointSegment(mirroredUv,vec2(0.49,0.4),vec2(0.49,0.35)),
      distPointSegment(mirroredUv,vec2(0.49,0.35),vec2(0.2,0.15)),
      distPointSegment(mirroredUv,vec2(0.2,0.15),vec2(0.2,0.0)),
      distPointSegment(mirroredUv,vec2(0.2,0.005),vec2(0.5,0.005)),
      
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

// const makeNewFieldSieve=Fn(([uv]:[ReturnType<typeof vec2>])=>{
//   const kindNew=KIND_AIR.toVar("kindNew");
//   const thickness=float(0.5*0.01).toVar("thickness");
//   // 篩（ふるい）
//   Loop(11,({i})=>{
//     const offset = vec2(0.1,0).mul(float(i));
//     If(distPointSegment(uv,vec2(-0.05,0.2).add(offset),vec2(0.05,0.1).add(offset)).lessThanEqual(thickness),()=>{
//       kindNew.assign(KIND_WALL);
//     });

//   });
//   return kindNew;
// }).setLayout({
//   name:"makeNewFieldSieve",
//   type:"int",
//   inputs:[
//     {
//       name:"uv",
//       type:"vec2",
//     },
//   ],
// });

const makeNewFieldSlope=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");
  // 坂
  Loop(2,({i})=>{
    const offset = vec2(1,0).mul(float(i));
    If(distPointSegment(uv,vec2(-0.2,0.005).add(offset),vec2(0.9,0.405).add(offset)).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });

  });
  return kindNew;
}).setLayout({
  name:"makeNewFieldSlope",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});

const makeNewFieldStairs=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");

  const p1=vec2(-0.05,0.65).toVar("p1");
  const p2=vec2(0.05,0.65).toVar("p2");
  const p3=vec2(0.05,0.55).toVar("p3");

  // 階段
  Loop(10,4,({i,j})=>{
    const offset = vec2(0.1,-0.1).mul(float(i));
    // 上下左右ループ境界を跨ぐ段を拾うため、x,y方向に合計4回判定する
    const wrappedUv = uv.sub(offset).sub(vec2(j.mod(2),j.div(2))).toVar("wrappedUv");
    If(distPointSegment(wrappedUv,p1,p2).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });
    If(distPointSegment(wrappedUv,p2,p3).lessThanEqual(thickness),()=>{
      kindNew.assign(KIND_WALL);
    });
  });

  return kindNew;
}).setLayout({
  name:"makeNewFieldStairs",
  type:"int",
  inputs:[
    {
      name:"uv",
      type:"vec2",
    },
  ],
});

// const makeNewFieldCliffSlope=Fn(([uv]:[ReturnType<typeof vec2>])=>{
//   const kindNew=KIND_AIR.toVar("kindNew");
//   const thickness=float(0.5*0.01).toVar("thickness");


//   // 階段
//   Loop(5,4,({i,j})=>{
//     const offset = vec2(0.2,0).mul(float(i));
//     // 上下左右ループ境界を跨ぐ段を拾うため、x,y方向に合計4回判定する
//     const wrappedUv = uv.sub(offset).sub(vec2(j.mod(2),j.div(2))).toVar("wrappedUv");
//     If(distPointSegment(wrappedUv,vec2(-0.1,0.5),vec2(0.1,-0.5)).lessThanEqual(thickness),()=>{
//       kindNew.assign(KIND_WALL);
//     });
//   });

//   return kindNew;
// }).setLayout({
//   name:"makeNewFieldCliffSlope",
//   type:"int",
//   inputs:[
//     {
//       name:"uv",
//       type:"vec2",
//     },
//   ],
// });

const makeNewFieldSpike=Fn(([uv]:[ReturnType<typeof vec2>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  const thickness=float(0.5*0.01).toVar("thickness");

  // 三角屋根がたくさん
  const l=float(0.09).toVar("l");
  const pt=vec2(0.1,0.1).toVar("pt");
  const pp=pt.add(vec2(l,l.mul(-1))).toVar("pp");
  const pm=pt.add(vec2(l.mul(-1),l.mul(-1))).toVar("pm");

  If(uv.y.lessThan(0.5),()=>{
    Loop(2,({i})=>{
      const repeatUv=uv.add(vec2(0.1,0.125).mul(i)).mod(vec2(0.2,0.25)).toVar("repeatUv");
      If(distPointSegment(repeatUv,pt,pp).lessThanEqual(thickness),()=>{
        kindNew.assign(KIND_WALL);
      });
      If(distPointSegment(repeatUv,pt,pm).lessThanEqual(thickness),()=>{
        kindNew.assign(KIND_WALL);
      });
    });
  });



  return kindNew;
}).setLayout({
  name:"makeNewFieldSpike",
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
    kindNew.assign(makeNewFieldBucket(uv));
  }).ElseIf(fieldIndex.equal(int(1)),()=>{
    kindNew.assign(makeNewFieldSpike(uv));
  }).ElseIf(fieldIndex.equal(int(2)),()=>{
    kindNew.assign(makeNewFieldStairs(uv));
  }).ElseIf(fieldIndex.equal(int(3)),()=>{
    kindNew.assign(makeNewFieldSlope(uv));
  }).ElseIf(fieldIndex.equal(int(4)),()=>{
    kindNew.assign(makeNewFieldHourglass(uv));
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
