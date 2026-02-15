import * as THREE from 'three/webgpu';
import { getErrorMessage } from './log_utils';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebcamErrorHint(error?: unknown): string | undefined {
  // Insecure origins cannot use getUserMedia except for localhost.
  if (typeof isSecureContext !== 'undefined' && !isSecureContext) {
    return 'Webカメラを使用するには HTTPS で開くか、例外扱いの http://localhost を利用してください。';
  }

  const domError = error as Partial<DOMException> | undefined;
  switch (domError?.name) {
  case 'NotAllowedError':
  case 'PermissionDeniedError':
    return 'ブラウザのカメラ権限がブロックされています。許可してください。';
  case 'NotFoundError':
  case 'DevicesNotFoundError':
    return 'カメラデバイスが見つかりません。接続を確認してください。';
  case 'NotReadableError':
    return 'カメラが他のアプリで使用中の可能性があります。';
  case 'SecurityError':
    return 'セキュリティ設定によりカメラにアクセスできません。';
  default:
    return undefined;
  }
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
    canvasTexture: THREE.CanvasTexture,
  ) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    const canvasContext = canvasElement.getContext('2d');
    if (!canvasContext) {
      throw new Error('Failed to acquire 2D context from webcam canvas.');
    }
    this.canvasContext = canvasContext;
    this.canvasTexture = canvasTexture;
    this.size = new THREE.Vector2(canvasElement.width, canvasElement.height);
  }

  static async create(videoElement: HTMLVideoElement): Promise<WebcamCanvasTexture> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices interface not available.');
    }
    const secureContextHint = getWebcamErrorHint();
    if (secureContextHint) {
      throw new Error(secureContextHint);
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
      const hint = getWebcamErrorHint(error);
      const detail = getErrorMessage(error);
      if (hint) {
        throw new Error(`Webカメラにアクセスできません。\n${hint}\n${detail}`);
      }
      throw new Error(`Webカメラにアクセスできません。${detail}`);
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


    // NOTE: Wait a tick to ensure the first frame is ready before drawing.
    await delay(500);

    const canvasTexture = new THREE.CanvasTexture(canvasElement);
    canvasTexture.colorSpace=THREE.SRGBColorSpace;
    const instance = new WebcamCanvasTexture(
      videoElement,
      canvasElement,
      canvasTexture,
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
