// cropPng(): cuts a rectangle out of a PNG, with Node's zlib and no image
// library. Used once, for the hourglass in LimitedTimeDragonariumHelpIcon.png.
// Handles 8-bit, non-interlaced PNGs (grey, RGB, palette, grey+alpha, RGBA),
// which is what the wiki serves; anything else throws.

import { crc32, deflateSync, inflateSync } from 'node:zlib';

export type CropBox = { x: number; y: number; width: number; height: number };

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Bytes per pixel at bit depth 8, by colour type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
/** Chunks copied to the cropped file as they are (palette and transparency). */
const KEPT = new Set(['PLTE', 'tRNS']);

export function isPng(data: Uint8Array): boolean {
  return data.length >= 8 && Buffer.from(data.subarray(0, 8)).equals(SIGNATURE);
}

export type DecodedPng = {
  width: number;
  height: number;
  colorType: number;
  /** Bytes per pixel. */
  channels: number;
  /** Rows of width * channels bytes, unfiltered. */
  pixels: Buffer;
  /** PLTE and tRNS, kept as they are. */
  kept: { type: string; body: Buffer }[];
};

export function decodePng(data: Uint8Array): DecodedPng {
  const { header, idat, kept } = readChunks(data);
  const { width, height, bitDepth, colorType, interlace } = header;
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || channels === undefined || interlace !== 0) {
    throw new Error(`Only 8-bit non-interlaced PNGs are handled (depth ${bitDepth}, colour type ${colorType}, interlace ${interlace})`);
  }
  return { width, height, colorType, channels, pixels: unfilter(inflateSync(idat), width, height, channels), kept };
}

export function encodePng(png: DecodedPng): Buffer {
  const { width, height, colorType, channels, pixels, kept } = png;
  const stride = width * channels;
  const rows = Buffer.alloc(height * (1 + stride));
  for (let row = 0; row < height; row++) {
    rows[row * (1 + stride)] = 0; // filter: none
    pixels.copy(rows, row * (1 + stride) + 1, row * stride, (row + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    ...kept.map(({ type, body }) => chunk(type, body)),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function cropPng(data: Uint8Array, box: CropBox): Buffer {
  const png = decodePng(data);
  const { width, height, channels } = png;
  const { x, y, width: w, height: h } = box;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) {
    throw new Error(`Crop box ${JSON.stringify(box)} doesn't fit a ${width}x${height} image`);
  }
  const pixels = Buffer.alloc(w * h * channels);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * width + x) * channels;
    png.pixels.copy(pixels, row * w * channels, start, start + w * channels);
  }
  return encodePng({ ...png, width: w, height: h, pixels });
}

type Header = { width: number; height: number; bitDepth: number; colorType: number; interlace: number };

function readChunks(data: Uint8Array): { header: Header; idat: Buffer; kept: { type: string; body: Buffer }[] } {
  const buf = Buffer.from(data);
  if (!isPng(buf)) throw new Error('Not a PNG file');
  let header: Header | null = null;
  const idat: Buffer[] = [];
  const kept: { type: string; body: Buffer }[] = [];
  let at = 8;
  while (at + 8 <= buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    at += 12 + length;
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8]!,
        colorType: body[9]!,
        interlace: body[12]!,
      };
    } else if (type === 'IDAT') idat.push(body);
    else if (KEPT.has(type)) kept.push({ type, body });
    else if (type === 'IEND') break;
  }
  if (!header) throw new Error('PNG has no IHDR chunk');
  return { header, idat: Buffer.concat(idat), kept };
}

/** Undoes the per-row filters, returning the bare pixel bytes. */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const src = row * (stride + 1) + 1;
    const dst = row * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[dst + i - bpp]! : 0;
      const b = row > 0 ? out[dst - stride + i]! : 0;
      const c = row > 0 && i >= bpp ? out[dst - stride + i - bpp]! : 0;
      let predictor: number;
      switch (filter) {
        case 0: predictor = 0; break;
        case 1: predictor = a; break;
        case 2: predictor = b; break;
        case 3: predictor = (a + b) >> 1; break;
        case 4: predictor = paeth(a, b, c); break;
        default: throw new Error(`Unknown PNG filter ${filter} in row ${row}`);
      }
      out[dst + i] = (raw[src + i]! + predictor) & 0xff;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}
