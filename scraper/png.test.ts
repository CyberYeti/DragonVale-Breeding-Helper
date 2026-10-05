import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cropPng, decodePng, encodePng, isPng } from './png';

/** A 3x2 RGB image whose pixel (x, y) is [10y + x, 0, 255]. */
const pixels = Buffer.from([0, 0, 255, 1, 0, 255, 2, 0, 255, 10, 0, 255, 11, 0, 255, 12, 0, 255]);
const image = () => ({ width: 3, height: 2, colorType: 2, channels: 3, pixels: Buffer.from(pixels), kept: [] });

describe('encodePng / decodePng', () => {
  it('round-trips the pixels', () => {
    const data = encodePng(image());
    expect(isPng(data)).toBe(true);
    const back = decodePng(data);
    expect([back.width, back.height, back.channels]).toEqual([3, 2, 3]);
    expect([...back.pixels]).toEqual([...pixels]);
  });

  it('undoes the Sub, Up, Average and Paeth row filters', () => {
    for (const filters of [
      [1, 2],
      [3, 4],
    ] as const) {
      const data = withIdat(encodePng(image()), deflateSync(filter(filters)));
      expect([...decodePng(data).pixels]).toEqual([...pixels]);
    }
  });

  it('refuses something that is not a PNG', () => {
    expect(() => decodePng(Buffer.from('RIFF....WEBP'))).toThrow(/Not a PNG/);
  });
});

describe('cropPng', () => {
  it('cuts the box out', () => {
    const out = decodePng(cropPng(encodePng(image()), { x: 1, y: 0, width: 2, height: 2 }));
    expect([out.width, out.height]).toEqual([2, 2]);
    expect([...out.pixels]).toEqual([1, 0, 255, 2, 0, 255, 11, 0, 255, 12, 0, 255]);
  });

  it('refuses a box outside the image', () => {
    expect(() => cropPng(encodePng(image()), { x: 2, y: 0, width: 2, height: 1 })).toThrow(/doesn't fit/);
  });
});

/** The test pixels as filtered PNG rows, row 0 with filters[0] and row 1 with filters[1]. */
function filter(filters: readonly [number, number]): Buffer {
  const bpp = 3;
  const stride = 9;
  const out = Buffer.alloc(2 * (1 + stride));
  for (let row = 0; row < 2; row++) {
    const type = filters[row]!;
    out[row * (1 + stride)] = type;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? pixels[row * stride + i - bpp]! : 0;
      const b = row > 0 ? pixels[(row - 1) * stride + i]! : 0;
      const c = row > 0 && i >= bpp ? pixels[(row - 1) * stride + i - bpp]! : 0;
      const p = a + b - c;
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][type]!;
      out[row * (1 + stride) + 1 + i] = (pixels[row * stride + i]! - predictor) & 0xff;
    }
  }
  return out;
}

/** The PNG with its IDAT chunk's body replaced (CRC left zero; the reader doesn't check it). */
function withIdat(png: Buffer, body: Buffer): Buffer {
  const at = png.indexOf('IDAT') - 4;
  const end = at + 12 + png.readUInt32BE(at);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write('IDAT', 4, 'latin1');
  return Buffer.concat([png.subarray(0, at), head, body, Buffer.alloc(4), png.subarray(end)]);
}
