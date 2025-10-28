import * as THREE from 'three/webgpu';
import { getErrorMessage } from './log_utils';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebcamCanvasTexture {
  private readonly videoElement: HTMLVideoElement;
  private readonly canvasElement: HTMLCanvasElement;
  private readonly canvasContext: CanvasRenderingContext2D;
  private readonly canvasTexture: THREE.CanvasTexture;
  readonly size: THREE.Vector2;

  private constructor(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    canvasContext: CanvasRenderingContext2D,
    canvasTexture: THREE.CanvasTexture,
    size: THREE.Vector2,
  ) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasContext = canvasContext;
    this.canvasTexture = canvasTexture;
    this.size = size;
  }

  static async create(videoElement: HTMLVideoElement): Promise<WebcamCanvasTexture> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices interface not available.');
    }

    const constraints: MediaStreamConstraints = {
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user',
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;
    } catch (error) {
      throw new Error(`Unable to access the camera/webcam. ${getErrorMessage(error)}`);
    }

    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      videoElement.addEventListener('loadedmetadata', () => resolve(), { once: true });
    });

    await videoElement.play();

    const canvasElement = document.createElement('canvas');
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    const canvasContext = canvasElement.getContext('2d');
    if (!canvasContext) {
      throw new Error('Failed to acquire 2D context from webcam canvas.');
    }

    // NOTE: Wait a tick to ensure the first frame is ready before drawing.
    await delay(500);

    const canvasTexture = new THREE.CanvasTexture(canvasElement);
    const size = new THREE.Vector2(canvasElement.width, canvasElement.height);
    const instance = new WebcamCanvasTexture(
      videoElement,
      canvasElement,
      canvasContext,
      canvasTexture,
      size,
    );
    instance.capture();
    return instance;
  }

  get texture(): THREE.CanvasTexture {
    return this.canvasTexture;
  }

  capture(): void {
    this.canvasContext.save();
    this.canvasContext.translate(this.canvasElement.width, 0);
    this.canvasContext.scale(-1, 1);
    this.canvasContext.drawImage(this.videoElement, 0, 0);
    this.canvasContext.restore();
    this.canvasTexture.needsUpdate = true;
  }
}

