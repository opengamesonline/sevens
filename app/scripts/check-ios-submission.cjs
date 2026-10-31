const { expo } = require('../app.json');
const eas = require('../eas.json');

function validateSubmission(appConfig, easConfig) {
  if (appConfig.ios.bundleIdentifier !== 'com.drasolabs.cardroom') {
    throw new Error('Expected the Card Room bundle ID: com.drasolabs.cardroom.');
  }
  const appId = easConfig.submit?.production?.ios?.ascAppId;
  if (typeof appId !== 'string' || !/^\d+$/.test(appId) || appId === '6826725191') {
    throw new Error(
      'Set submit.production.ios.ascAppId in app/eas.json to the NEW numeric Apple ID for '
      + 'com.drasolabs.cardroom. Do not reuse the old Sevens app record. See docs/ios-deployment.md.',
    );
  }
}

if (require.main === module) {
  try {
    validateSubmission(expo, eas);
    console.log('Card Room iOS submission target is configured.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateSubmission };
