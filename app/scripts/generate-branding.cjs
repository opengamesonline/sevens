// Run with `npm run branding:generate`. No fonts or external artwork required.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const felt = '#042B23';

function svgDocument(content, background = '', scale = 1) {
  const inset = (1024 - 1024 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
    <g transform="translate(${inset} ${inset}) scale(${scale})">${content}</g>
  </svg>`);
}

async function main() {
  const source = await fs.readFile(path.join(root, 'assets/branding/mark.svg'), 'utf8');
  const mono = await fs.readFile(path.join(root, 'assets/branding/monochrome.svg'), 'utf8');
  const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const mark = inner(source);
  const outputs = [
    ['icon.png', svgDocument(mark, felt, 1.15), 1024, true],
    // The complete artwork fits within Android's central 66/108 safe circle.
    ['android-icon-foreground.png', svgDocument(mark, '', 0.82), 1024],
    ['android-icon-background.png', svgDocument('', felt), 1024, true],
    ['android-icon-monochrome.png', svgDocument(inner(mono), '', 0.82), 1024],
    ['splash-icon.png', svgDocument(mark), 1024],
    ['favicon.png', svgDocument(mark, felt, 1.3), 64, true],
  ];
  for (const [name, svg, size, opaque] of outputs) {
    let image = sharp(svg).resize(size, size);
    if (opaque) image = image.removeAlpha();
    await image.png().toFile(path.join(root, 'assets/images', name));
    console.log(`Generated ${name} (${size}×${size})`);
  }
  // Icon Composer uses the same vector artwork, not a flattened PNG.
  await fs.writeFile(path.join(root, 'assets/expo.icon/Assets/sevens.svg'), svgDocument(mark, '', 1.15));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
