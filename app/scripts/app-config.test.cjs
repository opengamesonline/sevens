const assert = require('node:assert/strict');
const test = require('node:test');
const { expo } = require('../app.json');

test('Card Room uses the new native identity and display name', () => {
  assert.equal(expo.name, 'Card Room');
  assert.equal(expo.ios.bundleIdentifier, 'com.drasolabs.cardroom');
  assert.equal(expo.android.package, 'com.drasolabs.cardroom');
  assert.equal(expo.scheme, 'drasolabscardroom');
});

test('the new Card Room Expo project is linked', () => {
  assert.equal(expo.owner, 'drasolabs');
  assert.equal(expo.slug, 'cardroom');
  assert.equal(expo.extra.eas.projectId, '6beddb09-a647-4179-820b-b79513017133');
});
