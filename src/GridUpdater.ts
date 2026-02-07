import { float, Fn, instanceIndex, positionLocal, uniform, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';


export class GridUpdater{
  private readonly uTime:THREE.UniformNode<number> = uniform(0);
  private readonly grid:THREE.Mesh<THREE.BoxGeometry, THREE.MeshMatcapNodeMaterial, THREE.Object3DEventMap>;
  private readonly gridSize:number;
  private readonly gridResolution:number;
  constructor(grid:THREE.Mesh<THREE.BoxGeometry, THREE.MeshMatcapNodeMaterial, THREE.Object3DEventMap>,gridSize:number,gridResolution:number){
    this.grid = grid;
    this.gridSize=gridSize;
    this.gridResolution=gridResolution;
    this.grid.count = this.gridResolution * this.gridResolution;

    this.grid.material.positionNode = Fn(()=>{
      const ix = float(instanceIndex.mod(this.gridResolution)).toVar();
      const iy = float(instanceIndex.div(this.gridResolution)).toVar();
      const cellSize = float(this.gridSize / this.gridResolution).toVar();


      const gridOffset = float(this.gridSize).mul(-0.5).add(cellSize.mul(0.5));
      const offsetPositionBase = vec3(ix.mul(cellSize).add(gridOffset),iy.mul(cellSize).add(gridOffset),0).toVar();
      const offsetPosition = offsetPositionBase.mul(this.uTime.mul(0.25).add(1));
      
      const time = float(this.uTime).toVar();
      const halfGravity = float(-2).mul(0.5);
      const movePosition = vec3(0,time.mul(time).mul(halfGravity),0);
      return positionLocal.add(offsetPosition.add(movePosition));
    })();

  }
  set time(newTime:number){
    this.uTime.value = newTime;
  }
  createGridUvNode(){
    return Fn(()=>{
      const uvNode = uv().toVar();
      const ix = float(instanceIndex.mod(this.gridResolution)).toVar();
      const iy = float(instanceIndex.div(this.gridResolution)).toVar();

      const gridUvNode=uvNode.add(vec2(ix,iy)).div(vec2(this.gridResolution)).toVar();

      return gridUvNode;
    })(); 
  }

}
