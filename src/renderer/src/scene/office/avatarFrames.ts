import { Texture } from 'pixi.js';
import { renderAvatarScene, type AvatarSpec } from './avatar';

function toTexture(pixels: Uint8ClampedArray, w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

/** Same 3 x 7 frame grid the office Character expects (down, up, right; walk, type, read), built from a spec. */
export function getAvatarFrames(spec: AvatarSpec): Texture[][] {
  const { w, h, front, back } = renderAvatarScene(spec);
  const row = (bufs: Uint8ClampedArray[]): Texture[] => {
    const [stand, stepL, stepR] = bufs.map((b) => toTexture(b, w, h));
    return [stand, stepL, stepR, stand, stand, stand, stand];
  };
  const frontRow = row(front);
  return [frontRow, row(back), frontRow];
}
