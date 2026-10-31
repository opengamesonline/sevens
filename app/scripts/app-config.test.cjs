const assert = require('node:assert/strict');
const test = require('node:test');
const { expo } = require('../app.json');
const eas = require('../eas.json');
const { validateSubmission } = require('./check-ios-submission.cjs');

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

test('submission remains unconfigured or targets a new numeric Apple ID', () => {
  const appId = eas.submit.production.ios.ascAppId;
  if (appId !== undefined) validateSubmission(expo, eas);
});

const submissionConfig = (ascAppId) => ({ submit: { production: { ios: { ascAppId } } } });

test('deployment rejects a missing, malformed, or old Sevens Apple ID', () => {
  for (const appId of [undefined, '', 'NEW_APP_ID', '6826725191']) {
    assert.throws(() => validateSubmission(expo, submissionConfig(appId)), /NEW numeric Apple ID/);
  }
});

test('deployment accepts a new numeric Apple ID', () => {
  assert.doesNotThrow(() => validateSubmission(expo, submissionConfig('1234567890')));
});

test('deployment rejects an unexpected bundle ID', () => {
  assert.throws(
    () => validateSubmission({ ios: { bundleIdentifier: 'com.example.other' } }, submissionConfig('1234567890')),
    /Expected the Card Room bundle ID/,
  );
});
