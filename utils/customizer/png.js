const zlib = require('zlib');

/**
 * Minimal PNG encoder.
 *
 * The kit texture maps are flat fills, so we can encode them directly without
 * pulling in a native canvas dependency (which would complicate the Vercel
 * deployment). This writes an 8-bit RGBA PNG with a single IDAT chunk.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function parseHexColor(value, fallback = { r: 255, g: 255, b: 255, a: 255 }) {
  const clean = String(value || '').trim().replace('#', '');
  if (clean.length === 3) {
    const r = clean[0];
    const g = clean[1];
    const b = clean[2];
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
      a: 255,
    };
  }
  if (clean.length !== 6) return fallback;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: 255,
  };
}

function lighten(color, amount) {
  return {
    r: Math.min(255, color.r + Math.round(255 * amount)),
    g: Math.min(255, color.g + Math.round(255 * amount)),
    b: Math.min(255, color.b + Math.round(255 * amount)),
    a: color.a,
  };
}

/**
 * Encode an RGBA pixel buffer as a PNG.
 *
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array} rgba Row-major RGBA bytes, length = width*height*4
 * @returns {Buffer}
 */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    // Filter type 0 (None) for every scanline.
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer || rgba, rgba.byteOffset || 0, rgba.length).copy(
      raw,
      y * (stride + 1) + 1,
      y * stride,
      (y + 1) * stride
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Render a flat colour map with a procedural pattern.
 *
 * @param {number} width
 * @param {number} height
 * @param {string} baseColor
 * @param {string} pattern One of: none, stripes, hoops, halves, sash, checks, gradient
 * @returns {Buffer} PNG bytes
 */
function renderColorMap(width, height, baseColor, pattern = 'none') {
  const base = parseHexColor(baseColor);
  const secondary = lighten(base, 0.35);
  const pixels = Buffer.alloc(width * height * 4);

  const stripeWidth = width / 12;
  const hoopHeight = height / 14;
  const cell = Math.min(width, height) / 10;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let color = base;

      if (pattern === 'stripes') {
        if (x % (stripeWidth * 2) < stripeWidth) color = secondary;
      } else if (pattern === 'hoops') {
        if (y % (hoopHeight * 2) < hoopHeight) color = secondary;
      } else if (pattern === 'halves') {
        if (x < width / 2) color = secondary;
      } else if (pattern === 'sash') {
        // A band across the diagonal.
        const diagonal = x + (height - y);
        const centre = (width + height) / 2;
        if (Math.abs(diagonal - centre) < height * 0.09) color = secondary;
      } else if (pattern === 'checks') {
        const cx = Math.floor(x / cell);
        const cy = Math.floor(y / cell);
        if (cx % 2 === cy % 2) color = secondary;
      } else if (pattern === 'gradient') {
        const t = 1 - y / height;
        color = {
          r: Math.round(base.r + (255 - base.r) * t * 0.5),
          g: Math.round(base.g + (255 - base.g) * t * 0.5),
          b: Math.round(base.b + (255 - base.b) * t * 0.5),
          a: base.a,
        };
      }

      const offset = (y * width + x) * 4;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = color.a;
    }
  }

  return encodePng(width, height, pixels);
}

/**
 * Render a flat normal map. A constant normal is the valid default for a
 * garment without baked seam detail.
 */
function renderNormalMap(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 128;
    pixels[i + 1] = 128;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  return encodePng(width, height, pixels);
}

/**
 * Render the coefficient map: R = ambient occlusion, G = roughness,
 * B = metalness.
 */
function renderCoeffMap(width, height, roughness = 0.68) {
  const pixels = Buffer.alloc(width * height * 4);
  const green = Math.round(roughness * 255);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = green;
    pixels[i + 2] = 0;
    pixels[i + 3] = 255;
  }
  return encodePng(width, height, pixels);
}

/** Render the texture-attenuation approximation map. */
function renderTaaMap(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  return encodePng(width, height, pixels);
}

module.exports = {
  encodePng,
  renderColorMap,
  renderNormalMap,
  renderCoeffMap,
  renderTaaMap,
  parseHexColor,
};
