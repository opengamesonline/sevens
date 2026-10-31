const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const imagePath = (name) => path.join(root, 'assets/images', name);

test('full-color exports include both black and red suit ink', async () => {
  for (const name of ['icon.png', 'android-icon-foreground.png', 'splash-icon.png', 'favicon.png']) {
    const { data, info } = await sharp(imagePath(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let blackSuitPixels = 0;
    let redSuitPixels = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3] === 0) continue;
      if (data[i] === 32 && data[i + 1] === 37 && data[i + 2] === 34) blackSuitPixels++;
      if (data[i] === 182 && data[i + 1] === 59 && data[i + 2] === 63) redSuitPixels++;
    }
    assert.ok(blackSuitPixels > 0, `${name}: black-suit ink is missing`);
    assert.ok(redSuitPixels > 0, `${name}: red-suit ink is missing`);
  }
});

test('launcher icon is a square, opaque 1024px PNG', async () => {
  const metadata = await sharp(imagePath('icon.png')).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.hasAlpha, false);
});

test('adaptive foreground and monochrome artwork fit inside the safe circle', async () => {
  for (const name of ['android-icon-foreground.png', 'android-icon-monochrome.png']) {
    const { data, info } = await sharp(imagePath(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1024);
    assert.equal(info.height, 1024);
    let visiblePixels = 0;
    const radius = (1024 * 66) / 108 / 2;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
        visiblePixels++;
        assert.ok(Math.hypot(x + 0.5 - 512, y + 0.5 - 512) <= radius, `${name}: pixel outside safe circle at ${x},${y}`);
      }
    }
    assert.ok(visiblePixels > 10000, `${name} is empty`);
  }
});

test('splash has transparency and favicon is 64px', async () => {
  const splash = await sharp(imagePath('splash-icon.png')).metadata();
  assert.equal(splash.hasAlpha, true);
  const favicon = await sharp(imagePath('favicon.png')).metadata();
  assert.equal(favicon.width, 64);
  assert.equal(favicon.height, 64);
});

test('all configured branding files and Icon Composer layers exist', async () => {
  const { expo } = JSON.parse(await fs.readFile(path.join(root, 'app.json'), 'utf8'));
  const splash = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  const paths = [expo.icon, expo.web.favicon, splash.image,
    expo.android.adaptiveIcon.foregroundImage, expo.android.adaptiveIcon.backgroundImage,
    expo.android.adaptiveIcon.monochromeImage];
  for (const file of paths) await fs.access(path.join(root, file));
  const composer = JSON.parse(await fs.readFile(path.join(root, expo.ios.icon, 'icon.json'), 'utf8'));
  for (const group of composer.groups) {
    for (const layer of group.layers) {
      await fs.access(path.join(root, expo.ios.icon, 'Assets', layer['image-name']));
    }
  }
});
