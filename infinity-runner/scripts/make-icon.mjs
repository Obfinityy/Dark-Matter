#!/usr/bin/env node
/**
 * make-icon.js — wrap assets/icon.png into a valid Windows .ico.
 *
 * Windows (Vista+) and electron-builder accept PNG-compressed entries inside
 * an ICO container, so no native image tooling is needed: we write the ICO
 * header + directory entry and embed the PNG bytes verbatim.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PNG_PATH = path.join(here, '..', 'assets', 'icon.png');
const ICO_PATH = path.join(here, '..', 'assets', 'icon.ico');

async function main() {
  const png = await readFile(PNG_PATH);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 0 = 256 (we store the real size in the PNG anyway)
  entry[1] = 0; // height 0 = 256
  entry[2] = 0; // no palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // PNG byte size
  entry.writeUInt32LE(6 + 16, 12); // offset of image data

  await writeFile(ICO_PATH, Buffer.concat([header, entry, png]));
  console.log(`wrote ${ICO_PATH} (${png.length} byte PNG payload)`);
}

main().catch((err) => {
  console.error('make-icon failed:', err.message);
  process.exit(1);
});
