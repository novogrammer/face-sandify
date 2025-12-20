import Stats from "stats-gl";
import { ENABLE_FORCE_WEBGL, SAND_SIMULATOR_WIDTH, SAND_SIMULATOR_HEIGHT, ITERATION_PER_SEC, ITERATION_PER_STEP_MAX, CAPTURE_CYCLE_DURATION, CLEAR_CYCLE_DURATION, FIELD_COUNT, ALTERNATE_FIELD_ON_CLEAR, FOREGROUND_GRID_SIZE, FOREGROUND_GRID_RESOLUTION, IS_DEBUG, FOV_MAX, CAMERA_Z } from './constants';
import { getElementSize, querySelectorOrThrow } from './dom_utils';
import { SandSimulator } from './sand/SandSimulator';
import { WebcamCanvasTexture } from './WebcamCanvasTexture';
import './style.scss'

import * as THREE from 'three/webgpu';
import { getErrorMessage } from "./log_utils";
import { GridUpdater } from "./GridUpdater";
import { uniform } from "three/tsl";
import { Inspector } from 'three/addons/inspector/Inspector.js';

function showError(message:string){
  const errorElement=querySelectorOrThrow<HTMLElement>(".p-error");
  errorElement.classList.remove("p-error--hidden");
  const errorMessageElement=querySelectorOrThrow<HTMLElement>(".p-error__message");
  errorMessageElement.textContent=message;

}

function calcFovYFromFovMax(aspect:number,fovMax:number){
  if(1 < aspect){
const fovY=Math.atan(Math.tan(fovMax*0.5*THREE.MathUtils.DEG2RAD)/aspect)*THREE.MathUtils.RAD2DEG*2;
    return fovY;
  }else{
    return fovMax;
  }
}


async function mainAsync(){
  const backgroundElement=querySelectorOrThrow<HTMLElement>(".p-background");

  const {width,height}=getElementSize(backgroundElement);
  const scene = new THREE.Scene();
  const aspect = width / height;
  const fovY = calcFovYFromFovMax(aspect,FOV_MAX);
  const camera = new THREE.PerspectiveCamera( fovY, aspect, 0.1, 1000 );

  // {
  //   const ambientLight=new THREE.AmbientLight(0xffffff,0.6);
  //   scene.add(ambientLight);
  // }
  // {
  //   const directionalLight=new THREE.DirectionalLight(0xffffff,2);
  //   directionalLight.position.set(10,10,10);
  //   scene.add(directionalLight);
  // }


  let renderer:THREE.WebGPURenderer;
  try{
    renderer = new THREE.WebGPURenderer({
      antialias:true,
      forceWebGL:ENABLE_FORCE_WEBGL,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( width, height );
    if(IS_DEBUG){
      const inspector = new Inspector();
      renderer.inspector = inspector;
      inspector.domElement.style.pointerEvents="auto";
    }
    renderer.domElement.classList.add("p-background__canvas");
    backgroundElement.appendChild( renderer.domElement );
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
  
  let stats:Stats|undefined;
  if(IS_DEBUG){
    stats=new Stats({
      precision:3,
      trackHz: true,
      trackGPU: true,
      trackCPT: true,
    });
    stats.init( renderer );
    stats.dom.style.top="0px";
    document.body.appendChild( stats.dom );

  }

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

  const matcap=new THREE.TextureLoader().load('assets/textures/matcaps/matcap-porcelain-white.jpg');
  let foregroundUpdater:GridUpdater;
  let foregroundPrimary:THREE.Mesh<THREE.BoxGeometry, THREE.MeshMatcapNodeMaterial, THREE.Object3DEventMap>;
  {
    const cellSize = FOREGROUND_GRID_SIZE / FOREGROUND_GRID_RESOLUTION;
    const geometry = new THREE.BoxGeometry( cellSize, cellSize, cellSize );
    const material = new THREE.MeshMatcapNodeMaterial({
      matcap,
    });
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

  let backgroundPrimary:THREE.Mesh<THREE.PlaneGeometry, THREE.MeshMatcapNodeMaterial, THREE.Object3DEventMap>;
  {
    const geometry = new THREE.PlaneGeometry( FOREGROUND_GRID_SIZE, FOREGROUND_GRID_SIZE);
    const material = new THREE.MeshMatcapNodeMaterial({
      matcap,
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
  // (max/min)倍する
  const uScale = uniform(1);
  let sandSimulatorBackground = new SandSimulator(
    SAND_SIMULATOR_WIDTH,
    SAND_SIMULATOR_HEIGHT,
    webcamTexture.texture,
    webcamTexture.size.clone(),
    gridUvNode,
    uScale,
  );
  let sandSimulatorForeground = new SandSimulator(
    SAND_SIMULATOR_WIDTH,
    SAND_SIMULATOR_HEIGHT,
    webcamTexture.texture,
    webcamTexture.size.clone(),
    gridUvNode,
    uScale,
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

  camera.position.z = CAMERA_Z;

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
    const aspect = width/height;
    camera.aspect=aspect;
    const fovY = calcFovYFromFovMax(aspect,FOV_MAX);
    camera.fov=fovY;
    camera.updateProjectionMatrix();
  }

  // testStructAsync(renderer).catch((error)=>{
  //   console.error(error);
  // })

  let previousTime=-0.001;
  let gridStartTime=0;
  let currentFieldIndex=0;

  renderer.setAnimationLoop( animate );
  function animate(){
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
        sandSimulatorBackground.updateFrame(renderer,isCapturing,isClearing,currentFieldIndex);
      }else{
        sandSimulatorBackground.uDeltaTime.value=0;
        sandSimulatorBackground.updateFrame(renderer,false,false,currentFieldIndex);
      }
    }
    if(stats){
      renderer.resolveTimestampsAsync( THREE.TimestampQuery.COMPUTE );
    }

    // {
    //   const rawShader = await renderer.debug.getShaderAsync( scene, camera, cube );
    //   console.log(rawShader);
    //   debugger;
    // }
    uScale.value = 1 < camera.aspect ? camera.aspect : 1 / camera.aspect;

    foregroundUpdater.time = time - gridStartTime;

    renderer.render( scene, camera );
    if(stats){
      renderer.resolveTimestampsAsync( THREE.TimestampQuery.RENDER );
      stats.update();
    }
    previousTime=time;
  }

}



mainAsync().catch((error)=>{
  console.error(error);
});

