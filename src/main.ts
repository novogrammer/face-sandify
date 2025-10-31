import Stats from "stats-gl";
import { ENABLE_FORCE_WEBGL, SAND_SIMULATOR_WIDTH, SAND_SIMULATOR_HEIGHT, ITERATION_PER_SEC, ITERATION_PER_STEP_MAX, CAPTURE_CYCLE_DURATION, CLEAR_CYCLE_DURATION, FIELD_COUNT, ALTERNATE_FIELD_ON_CLEAR, FOREGROUND_GRID_SIZE, FOREGROUND_GRID_RESOLUTION } from './constants';
import { getElementSize, querySelectorOrThrow } from './dom_utils';
import { SandSimulator } from './SandSimulator';
import { WebcamCanvasTexture } from './WebcamCanvasTexture';
import './style.scss'

import * as THREE from 'three/webgpu';
import { getErrorMessage } from "./log_utils";
import { GridUpdater } from "./GridUpdater";
// import { testStructAsync } from './test_struct';

function showError(message:string){
  const errorElement=querySelectorOrThrow<HTMLElement>(".p-error");
  errorElement.classList.remove("p-error--hidden");
  const errorMessageElement=querySelectorOrThrow<HTMLElement>(".p-error__message");
  errorMessageElement.textContent=message;

}


async function mainAsync(){
  const backgroundElement=querySelectorOrThrow<HTMLElement>(".p-background");

  const {width,height}=getElementSize(backgroundElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 30, width / height, 0.1, 1000 );

  {
    const ambientLight=new THREE.AmbientLight(0xffffff,0.6);
    scene.add(ambientLight);
  }
  {
    const directionalLight=new THREE.DirectionalLight(0xffffff,2);
    directionalLight.position.set(10,10,10);
    scene.add(directionalLight);
  }


  let renderer:THREE.WebGPURenderer;
  try{
    renderer = new THREE.WebGPURenderer({
      antialias:true,
      forceWebGL:ENABLE_FORCE_WEBGL,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( width, height );
    await renderer.init();
    const isWebGPUBackend = !!((renderer.backend as any)?.isWebGPUBackend);
    if(!isWebGPUBackend){
      throw new Error("isWebGPUBackend is false");
    }
  }catch(error){
    const message=`WebGPUの初期化に失敗しました。\n${getErrorMessage(error)}`;
    showError(message);
    console.error(error);
    return;
  }
  renderer.domElement.classList.add("p-background__canvas");
  backgroundElement.appendChild( renderer.domElement );
  const stats=new Stats({
    precision:3,
    trackHz: true,
    trackGPU: true,
    trackCPT: true,
  });
  stats.init( renderer );
  stats.dom.style.top="0px";
  document.body.appendChild( stats.dom );





  const webcamVideoElement = querySelectorOrThrow<HTMLVideoElement>(".p-webcam-video");
  let webcamTexture:WebcamCanvasTexture;
  try{
    webcamTexture=await WebcamCanvasTexture.create(webcamVideoElement);
  }catch(error){
    const message=`Webcamの初期化に失敗しました。\n${getErrorMessage(error)}`;
    showError(message);
    console.error(error);
    return;
  }

  let foregroundUpdater:GridUpdater;
  let foregroundPrimary:THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardNodeMaterial, THREE.Object3DEventMap>;
  {
    const cellSize = FOREGROUND_GRID_SIZE / FOREGROUND_GRID_RESOLUTION;
    const geometry = new THREE.BoxGeometry( cellSize, cellSize, cellSize );
    const material = new THREE.MeshStandardNodeMaterial();
    foregroundPrimary = new THREE.Mesh( geometry, material );
    foregroundPrimary.position.z = cellSize * -0.5;
    foregroundUpdater=new GridUpdater(foregroundPrimary,FOREGROUND_GRID_SIZE,FOREGROUND_GRID_RESOLUTION);
  }
  scene.add( foregroundPrimary );
  let foregroundSecondary = foregroundPrimary.clone();
  foregroundSecondary.visible=false;
  foregroundSecondary.count=foregroundPrimary.count;
  foregroundSecondary.material=foregroundPrimary.material.clone();
  scene.add(foregroundSecondary);

  let backgroundPrimary:THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardNodeMaterial, THREE.Object3DEventMap>;
  {
    const geometry = new THREE.PlaneGeometry( FOREGROUND_GRID_SIZE, FOREGROUND_GRID_SIZE);
    const material = new THREE.MeshStandardNodeMaterial({
      depthWrite:false,
    });
    backgroundPrimary = new THREE.Mesh( geometry, material );
  }
  scene.add( backgroundPrimary );
  let backgroundSecondary = backgroundPrimary.clone();
  backgroundSecondary.visible=false;
  backgroundSecondary.material=backgroundPrimary.material.clone();
  scene.add( backgroundSecondary );


  const gridUvNode = foregroundUpdater.createGridUvNode();
  let sandSimulatorBackground = new SandSimulator(
    SAND_SIMULATOR_WIDTH,
    SAND_SIMULATOR_HEIGHT,
    webcamTexture.texture,
    webcamTexture.size.clone(),
    gridUvNode,
  );
  let sandSimulatorForeground = new SandSimulator(
    SAND_SIMULATOR_WIDTH,
    SAND_SIMULATOR_HEIGHT,
    webcamTexture.texture,
    webcamTexture.size.clone(),
    gridUvNode,
  );
  function swapSandSimulators(){
    [sandSimulatorForeground,sandSimulatorBackground]=[sandSimulatorBackground,sandSimulatorForeground];
    [foregroundPrimary,foregroundSecondary]=[foregroundSecondary,foregroundPrimary];
    [backgroundPrimary,backgroundSecondary]=[backgroundSecondary,backgroundPrimary];

    foregroundPrimary.visible=true;
    foregroundSecondary.visible=false;
    backgroundPrimary.visible=true;
    backgroundSecondary.visible=false;
  }

  foregroundPrimary.material.colorNode=sandSimulatorForeground.colorNodeForGrid;
  foregroundSecondary.material.colorNode=sandSimulatorBackground.colorNodeForGrid;
  foregroundPrimary.material.needsUpdate=true;
  foregroundSecondary.material.needsUpdate=true;

  backgroundPrimary.material.colorNode=sandSimulatorBackground.colorNode;
  backgroundSecondary.material.colorNode=sandSimulatorForeground.colorNode;
  backgroundPrimary.material.needsUpdate=true;
  backgroundSecondary.material.needsUpdate=true;


  camera.position.z = 2.5;

  window.addEventListener("resize",()=>{
    onResize();
  })
  onResize();

  function onResize(){
    if(!backgroundElement){
      throw new Error("backgroundElement is null");
    }
    const {width,height}=getElementSize(backgroundElement);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width,height);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  }

  // testStructAsync(renderer).catch((error)=>{
  //   console.error(error);
  // })

  let isComputing=false;
  let previousTime=-0.001;
  let gridStartTime=0;
  let currentFieldIndex=0;

  renderer.setAnimationLoop( animate );
  async function animate(){
    if(isComputing){
      console.log("skip");
      return;
    }
    isComputing=true;
    const time=performance.now()*0.001;

    const deltaTime = time - previousTime;

    const duration=CAPTURE_CYCLE_DURATION;
    const isCapturing = Math.floor(previousTime/duration) < Math.floor(time/duration);
    const clearDuration=CLEAR_CYCLE_DURATION;
    const isClearing = Math.floor(previousTime/clearDuration) < Math.floor(time/clearDuration);
    if(isClearing && ALTERNATE_FIELD_ON_CLEAR){
      currentFieldIndex=(currentFieldIndex+1)%FIELD_COUNT;
      swapSandSimulators();
      gridStartTime = time;
    }
    if(isCapturing){
      webcamTexture.capture();
    }

    const iterationPerFrame=Math.min(
      ITERATION_PER_STEP_MAX,
      Math.max(1,
        Math.round(ITERATION_PER_SEC * deltaTime)
      )
    );
    for(let i=0;i<iterationPerFrame;i++){
      if(i==0){
        sandSimulatorBackground.uDeltaTime.value=deltaTime;
        await sandSimulatorBackground.updateFrameAsync(renderer,isCapturing,isClearing,currentFieldIndex);
      }else{
        sandSimulatorBackground.uDeltaTime.value=0;
        await sandSimulatorBackground.updateFrameAsync(renderer,false,false,currentFieldIndex);
      }
    }
    renderer.resolveTimestampsAsync( THREE.TimestampQuery.COMPUTE );

    // {
    //   const rawShader = await renderer.debug.getShaderAsync( scene, camera, cube );
    //   console.log(rawShader);
    //   debugger;
    // }

    foregroundUpdater.time = time - gridStartTime;

    await renderer.renderAsync( scene, camera );
    renderer.resolveTimestampsAsync( THREE.TimestampQuery.RENDER );
    stats.update();
    previousTime=time;
    isComputing=false;
  }

}



mainAsync().catch((error)=>{
  console.error(error);
});

