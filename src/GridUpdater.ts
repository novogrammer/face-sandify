import { float, Fn, instanceIndex, mat3, normalLocal, positionLocal, uniform, vec3, type ShaderNodeObject } from 'three/tsl';
import * as THREE from 'three/webgpu';


const mat3Node = (...values: any[]) => (mat3 as unknown as (...args: any[]) => any)(...values);

const axisAngleToMat3 = Fn(( [axisInput, angleInput]: [any, any] ) => {
  const axis = axisInput.normalize().toVar();
  const angle = angleInput;

  const cosTheta = angle.cos();
  const sinTheta = angle.sin();
  const oneMinusCos = float(1.0).sub(cosTheta);

  const ux = axis.x;
  const uy = axis.y;
  const uz = axis.z;

  return mat3Node(
    cosTheta.add(oneMinusCos.mul(ux.mul(ux))),
    oneMinusCos.mul(uy.mul(ux)).add(sinTheta.mul(uz)),
    oneMinusCos.mul(uz.mul(ux)).sub(sinTheta.mul(uy)),
    oneMinusCos.mul(ux.mul(uy)).sub(sinTheta.mul(uz)),
    cosTheta.add(oneMinusCos.mul(uy.mul(uy))),
    oneMinusCos.mul(uz.mul(uy)).add(sinTheta.mul(ux)),
    oneMinusCos.mul(ux.mul(uz)).add(sinTheta.mul(uy)),
    oneMinusCos.mul(uy.mul(uz)).sub(sinTheta.mul(ux)),
    cosTheta.add(oneMinusCos.mul(uz.mul(uz)))
  );
});


export class GridUpdater{
  private readonly uTime:ShaderNodeObject<THREE.UniformNode<number>> = uniform(0);
  private readonly grid:THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardNodeMaterial, THREE.Object3DEventMap>;
  private readonly gridSize:number;
  private readonly gridResolution:number;
  constructor(grid:THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardNodeMaterial, THREE.Object3DEventMap>,gridSize:number,gridResolution:number){
    this.grid = grid;
    this.gridSize=gridSize;
    this.gridResolution=gridResolution;
    this.grid.count = this.gridResolution * this.gridResolution;

    const orientation = axisAngleToMat3(vec3(0,1,0),float(this.uTime).mul(180*THREE.MathUtils.DEG2RAD)).toVar();
    this.grid.material.positionNode = Fn(()=>{
      const ix = float(instanceIndex.mod(this.gridResolution)).toVar();
      const iy = float(instanceIndex.div(this.gridResolution)).toVar();
      const cellSize = float(this.gridSize / this.gridResolution).toVar();


      const gridOffset = float(this.gridSize).mul(-0.5).add(cellSize.mul(0.5));
      const offsetPositionBase = vec3(ix.mul(cellSize).add(gridOffset),iy.mul(cellSize).add(gridOffset),0).toVar();
      const offsetPosition = offsetPositionBase//.mul(this.uTime.mul(1).add(1));
      
      const time = float(this.uTime).toVar();
      const halfGravity = float(-1).mul(0.5);
      const movePosition = vec3(0,time.mul(time).mul(halfGravity),0);
      return orientation.mul(positionLocal).add(offsetPosition.add(movePosition));
    })();

    this.grid.material.normalNode = Fn(() => {
      return orientation.mul(normalLocal).normalize();
    })();

  }
  set time(newTime:number){
    this.uTime.value = newTime;
  }
}
