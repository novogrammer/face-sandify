import { bool, float, Fn, frameId, If, instanceIndex, int, select, dot, struct, texture, uniform, vec2, vec3, vec4, mix, clamp, length, min, hash, not, fract, instancedArray, floor, uv } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { IGNORE_SAND_TTL, SAND_SPACING, SAND_TTL_MAX, SAND_TTL_MIN, SHOW_WGSL_CODE } from './constants';
// 


const KIND_AIR=int(0);
const KIND_SAND=int(1);
const KIND_WALL=int(2);
const KIND_SINK=int(3);

const CAPTURE_POINT=vec2(0.5,0.65);
const CAPTURE_RADIUS=float(0.25);
const CAPTURE_UV_SCALE=float(2.0);

// Cell構造体の定義
const Cell = struct({
    kind: 'int',
    luminance: 'float',
    ttl: 'float',
},"Cell");

type FloatStorageNode = ReturnType<typeof instancedArray>;

const toColor = Fn(([cell]:[ReturnType<typeof Cell>])=>{
  const rgb=vec3(1.0).toVar("rgb");
  const luminance=cell.get("luminance").toVar("luminance");
  If(cell.get("kind").equal(KIND_WALL),()=>{
    rgb.assign(vec3(0.0,1.0,1.0));
  }).ElseIf(cell.get("kind").equal(KIND_SAND),()=>{
    rgb.assign(mix(vec3(0.75,0.0,0.0),vec3(1.0,0.75,0.0),luminance));
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

const isAirLikeCell=Fn(([cell]:[ReturnType<typeof Cell>])=>{
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

const makeNewFieldA=Fn(([uv,width]:[ReturnType<typeof vec2>,ReturnType<typeof int>])=>{
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
const makeNewFieldB=Fn(([uv,width]:[ReturnType<typeof vec2>,ReturnType<typeof int>])=>{
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

const makeNewField=Fn(([uv,width,fieldIndex]:[ReturnType<typeof vec2>,ReturnType<typeof int>,ReturnType<typeof float>])=>{
  const kindNew=KIND_AIR.toVar("kindNew");
  If(fieldIndex.equal(int(0)),()=>{
    kindNew.assign(makeNewFieldA(uv,width));
  }).ElseIf(fieldIndex.equal(int(1)),()=>{
    kindNew.assign(makeNewFieldB(uv,width));
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


export class SandSimulator{
  private readonly width:number;
  private readonly height:number;
  private readonly webcamTexture:THREE.Texture;
  private readonly storageKindPing:FloatStorageNode;
  private readonly storageKindPong:FloatStorageNode;
  private readonly storageLuminancePing:FloatStorageNode;
  private readonly storageLuminancePong:FloatStorageNode;
  private readonly storageTtlPing:FloatStorageNode;
  private readonly storageTtlPong:FloatStorageNode;

  private readonly uIsCapturing:THREE.UniformNode<number>;
  private readonly uWebcamTextureSize:THREE.UniformNode<THREE.Vector2>;
  readonly _uDeltaTime:THREE.UniformNode<number>;
  get uDeltaTime(){
    return this._uDeltaTime;
  }

  private readonly uIsClearing:THREE.UniformNode<number>;
  private readonly uFieldIndex:THREE.UniformNode<number>;

  private readonly computeNodePing:THREE.ComputeNode;
  private readonly computeNodePong:THREE.ComputeNode;

  private readonly _colorNode:THREE.TSL.ShaderCallNodeInternal;
  get colorNode(){
    return this._colorNode;
  }

  private readonly _colorNodeForGrid:THREE.TSL.ShaderCallNodeInternal;
  get colorNodeForGrid(){
    return this._colorNodeForGrid;
  }

  private isPing:boolean=true;
  private readonly uIsPing:THREE.UniformNode<number>=uniform(1);

  constructor(width:number,height:number,webcamTexture:THREE.Texture,webcamTextureSize:THREE.Vector2,gridUvNode:THREE.Node,uScale:THREE.UniformNode<number>){
    this.width=width;
    this.height=height;
    this.webcamTexture=webcamTexture;

    const cellCount=width*height;
    const createFloatStorage=(label:string)=>instancedArray(new Float32Array(cellCount),"float").setName(label) as FloatStorageNode;
    this.storageKindPing=createFloatStorage("kindPing");
    this.storageKindPong=createFloatStorage("kindPong");
    this.storageLuminancePing=createFloatStorage("luminancePing");
    this.storageLuminancePong=createFloatStorage("luminancePong");
    this.storageTtlPing=createFloatStorage("ttlPing");
    this.storageTtlPong=createFloatStorage("ttlPong");
    

    this.uIsCapturing=uniform(0).setName("uIsCapturing");
    this.uWebcamTextureSize=uniform(webcamTextureSize).setName("uWebcamTextureSize");
    this._uDeltaTime=uniform(0).setName("uDeltaTime");
    this.uIsClearing=uniform(0).setName("uIsClearing");
    this.uFieldIndex=uniform(0).setName("uFieldIndex");

    // コンピュートシェーダーの定義
    const computeShader = Fn(([
      kindInput,
      luminanceInput,
      ttlInput,
      kindOutput,
      luminanceOutput,
      ttlOutput,
    ]:[
      FloatStorageNode,
      FloatStorageNode,
      FloatStorageNode,
      FloatStorageNode,
      FloatStorageNode,
      FloatStorageNode,
    ]) => {
      const coord = vec2(instanceIndex.mod(width), instanceIndex.div(width)).toVar("coord");
      // UV座標を手動で計算
      const uv = vec2(coord).div(vec2(width, height)).toVar("uv");
      const uvWebcam=uv.sub(0.5).mul(this.uWebcamTextureSize.yy).div(this.uWebcamTextureSize.xy).add(0.5).toVar("uvWebcam");

      uvWebcam.assign(fract(uvWebcam.sub(CAPTURE_POINT).mul(CAPTURE_UV_SCALE).add(CAPTURE_POINT)));

      const useLeftPriority = frameId.mod(2).equal(int(0)).toVar("useLeftPriority");
      const useLeftFactor = vec2(select(useLeftPriority , 1.0 , -1.0), 1.0).toVar("useLeftFactor");

      const pickCell=Fn(([coord,offsetOriginal,useLeftFactor]:[ReturnType<typeof vec2>,ReturnType<typeof vec2>,ReturnType<typeof vec2>])=>{
        const offset = offsetOriginal.mul(useLeftFactor).toVar("offset");
        const uvNeighbor = coord.add(offset).add(vec2(width, height)).mod(vec2(width, height)).toVar("uvNeighbor");
        const neighborIndex=int(uvNeighbor.y.mul(float(width)).add(uvNeighbor.x)).toVar("neighborIndex");
        const cell = Cell(
          int(kindInput.element(neighborIndex)),
          luminanceInput.element(neighborIndex),
          ttlInput.element(neighborIndex),
        ).toVar("cell");
        return cell;

      }).setLayout({
        name:"pickCell",
        type:"Cell",
        inputs:[
          {
            name:"coord",
            type:"vec2",
          },
          {
            name:"offsetOriginal",
            type:"vec2",
          },
          {
            name:"useLeftFactor",
            type:"vec2",
          },
        ],
      });


      const cellSelf = pickCell(coord,vec2(0, 0),useLeftFactor).toVar("cellSelf");
      const cellUp = pickCell(coord,vec2(0, 1),useLeftFactor).toVar("cellUp");
      // const cellLeftUp = pickCell(coord,vec2(-1, 1),useLeftFactor).toVar("cellLeftUp");
      const cellLeft = pickCell(coord,vec2(-1, 0),useLeftFactor).toVar("cellLeft");
      const cellRightUp = pickCell(coord,vec2(1, 1),useLeftFactor).toVar("cellRightUp");
      const cellRight = pickCell(coord,vec2(1, 0),useLeftFactor).toVar("cellRight");

      const cellDown = pickCell(coord,vec2(0, -1),useLeftFactor).toVar("cellDown");
      // const cellRightDown = pickCell(coord,vec2(1, -1),useLeftFactor).toVar("cellRightDown");
      const cellLeftDown = pickCell(coord,vec2(-1, -1),useLeftFactor).toVar("cellLeftDown");

      const cellNext = Cell().toVar("cellNext");
      const cellAir = Cell(
        KIND_AIR,
        float(0),
        float(0),
      ).toVar("cellAir");

      cellNext.assign(cellSelf);


      If(isAirLikeCell(cellSelf),()=>{
        // watch up

        If(cellUp.get("kind").equal(KIND_SAND),()=>{
          // 砂を上から移動させる
          cellNext.assign(cellUp);
        }).ElseIf(bool(cellLeft.get("kind").equal(KIND_SAND)).and(not(isAirLikeCell(cellLeftDown))).and(isAirLikeCell(cellUp) ),()=>{
          // 砂を左から移動させる
          cellNext.assign(cellLeft);
        }).Else(()=>{
          // DO NOTHING
        });

      }).ElseIf(cellSelf.get("kind").equal(KIND_SAND), ()=>{
        // watch down

        If(isAirLikeCell(cellDown),()=>{
          // 砂を下へ移動させる
          cellNext.assign(cellAir);
        }).ElseIf(isAirLikeCell(cellRight).and(not(isAirLikeCell(cellDown))).and(isAirLikeCell(cellRightUp)),()=>{
          // 砂を右へ移動させる
          cellNext.assign(cellAir);
        }).Else(()=>{
          // DO NOTHING
        });
      }).Else(()=>{
        // DO NOTHING
      });

      // SINKは素通りさせてから消す
      If(cellNext.get("kind").equal(KIND_SAND),()=>{
        If(cellSelf.get("kind").equal(KIND_SINK),()=>{
          // SINKで上書きすることで砂を消す
          cellNext.assign(cellSelf);
        }).Else(()=>{
          const ttl=cellNext.get("ttl").sub(IGNORE_SAND_TTL?0:this.uDeltaTime);
          If(ttl.greaterThan(0),()=>{
            cellNext.get("ttl").assign(ttl);
          }).Else(()=>{
            cellNext.assign(cellAir);
          });
        });
      });
      

      If(bool(this.uIsClearing),()=>{
        const kindNew=makeNewField(uv,float(width),int(this.uFieldIndex)).toVar("kindNew");
        If(kindNew.equal(KIND_WALL),()=>{
          cellNext.assign(Cell(
            KIND_WALL,
            float(0),
            float(0),
          ));
        }).ElseIf(kindNew.equal(KIND_SINK),()=>{
          cellNext.assign(Cell(
            KIND_SINK,
            float(0),
            float(0),
          ));
        }).Else(()=>{
          cellNext.assign(cellAir);
        });

      });

      If(bool(this.uIsCapturing),()=>{
        If(uv.sub(CAPTURE_POINT).length().lessThanEqual(CAPTURE_RADIUS),()=>{
          If(int(coord.x).mod(int(SAND_SPACING)).add(int(coord.y).mod(int(SAND_SPACING))).equal(int(0)),()=>{
            const ttl=mix(float(SAND_TTL_MIN),float(SAND_TTL_MAX),hash(uv.mul(100)));
            cellNext.assign(Cell(
              KIND_SAND,
              texture(this.webcamTexture,uvWebcam).r,
              ttl,
            ));
          });
        });
      });

      const selfIndex=int(coord.y.mul(float(width)).add(coord.x)).toVar("selfIndex");
      // 結果を書き込み
      kindOutput.element(selfIndex).assign(float(cellNext.get("kind")));
      luminanceOutput.element(selfIndex).assign(cellNext.get("luminance"));
      ttlOutput.element(selfIndex).assign(cellNext.get("ttl"));
    });  

    this.computeNodePing=computeShader(
      this.storageKindPing,
      this.storageLuminancePing,
      this.storageTtlPing,
      this.storageKindPong,
      this.storageLuminancePong,
      this.storageTtlPong,
    ).compute(this.width*this.height);
    this.computeNodePong=computeShader(
      this.storageKindPong,
      this.storageLuminancePong,
      this.storageTtlPong,
      this.storageKindPing,
      this.storageLuminancePing,
      this.storageTtlPing,
    ).compute(this.width*this.height);

    const sampleCell = Fn(([
      uvCoord,
      kindStorage,
      luminanceStorage,
      ttlStorage,
    ]:[
      ReturnType<typeof vec2>,
      FloatStorageNode,
      FloatStorageNode,
      FloatStorageNode,
    ]) => {
      const uvClamped=clamp(uvCoord,vec2(0.0),vec2(0.999999)).toVar();
      const scaled=floor(uvClamped.mul(vec2(float(width),float(height)))).toVar();
      const ix=int(clamp(scaled.x,0.0,float(width-1))).toVar();
      const iy=int(clamp(scaled.y,0.0,float(height-1))).toVar();
      const index=iy.mul(int(width)).add(ix).toVar();
      return Cell(
        int(kindStorage.element(index)),
        luminanceStorage.element(index),
        ttlStorage.element(index),
      );
    });

    {
      const colorFn = Fn(([
        uvNode,
        kindStorage,
        luminanceStorage,
        ttlStorage,
      ]:[
        THREE.Node,
        FloatStorageNode,
        FloatStorageNode,
        FloatStorageNode,
      ])=>{
        const remappedUvNode = uvNode.sub(vec2(0.5)).mul(uScale).add(vec2(0.5)).toVar().fract();
        const cell=sampleCell(remappedUvNode,kindStorage,luminanceStorage,ttlStorage).toVar();
        return toColor(cell);
      });
      {
        const colorNodePing=colorFn(uv(),this.storageKindPong,this.storageLuminancePong,this.storageTtlPong);
        const colorNodePong=colorFn(uv(),this.storageKindPing,this.storageLuminancePing,this.storageTtlPing);
        this._colorNode=select(this.uIsPing.notEqual(0),colorNodePing,colorNodePong);
      }
      {
        const colorNodePing=colorFn(gridUvNode,this.storageKindPong,this.storageLuminancePong,this.storageTtlPong);
        const colorNodePong=colorFn(gridUvNode,this.storageKindPing,this.storageLuminancePing,this.storageTtlPing);
        this._colorNodeForGrid=select(this.uIsPing.notEqual(0),colorNodePing,colorNodePong);
      }

    }
  }
  toggleTexture(){
    this.isPing=!this.isPing;
    this.uIsPing.value=this.isPing?1:0;
  }


  updateFrame(renderer:THREE.WebGPURenderer,isCapturing:boolean,isClearing:boolean,fieldIndex:number) {  
    this.toggleTexture();


    // コンピュートシェーダーを実行  
    this.uIsCapturing.value=isCapturing?1:0;
    this.uIsClearing.value=isClearing?1:0;
    this.uFieldIndex.value=fieldIndex|0;

    let computeNode;
    if(this.isPing){
      computeNode=this.computeNodePing;
    }else{
      computeNode=this.computeNodePong;
    }

    if(SHOW_WGSL_CODE){
      console.log((renderer as any)._nodes.getForCompute(computeNode).computeShader);
      debugger;
    }
    renderer.compute(computeNode);

      

  }
}
