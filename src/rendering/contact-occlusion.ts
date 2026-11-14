import * as T from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
/** Reuse the beauty pass's depth buffer instead of drawing the whole city again. */
export class ContactOcclusion extends GTAOPass {
  constructor(scene: T.Scene, camera: T.Camera) {
    super(scene, camera, 512, 512);
    this.blendIntensity = 0.65;
    this.updateGtaoMaterial({
      radius: 1.2,
      thickness: 0.6,
      distanceExponent: 2,
      distanceFallOff: 1,
      samples: 8,
      scale: 1,
    });
    this.updatePdMaterial({ radius: 3, rings: 2, samples: 8 });
  }
  override setSize(width: number, height: number) {
    super.setSize(
      Math.max(1, Math.ceil(width * 0.5)),
      Math.max(1, Math.ceil(height * 0.5)),
    );
  }
  override render(
    renderer: T.WebGLRenderer,
    writeBuffer: T.WebGLRenderTarget,
    readBuffer: T.WebGLRenderTarget,
  ) {
    if (
      readBuffer.depthTexture &&
      this.depthTexture !== readBuffer.depthTexture
    )
      this.setGBuffer(readBuffer.depthTexture);
    super.render(renderer, writeBuffer, readBuffer, 0, false);
  }
}
