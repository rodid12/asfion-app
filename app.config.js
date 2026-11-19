const base = require('./app.json').expo;

module.exports = () => {
  const variant = process.env.APP_VARIANT;
  const isQaApk = variant === 'qa';
  const isQaTestFlight = variant === 'qa-testflight';
  const isQa = isQaApk || isQaTestFlight;

  return {
    ...base,
    name: isQa ? 'ASFION QA' : base.name,
    scheme: isQa ? 'asfion-qa' : base.scheme,
    ios: {
      ...base.ios,
      // TestFlight debe conservar el bundle registrado en App Store Connect.
      bundleIdentifier: isQaApk ? 'com.asfion.app.qa' : base.ios.bundleIdentifier,
    },
    android: {
      ...base.android,
      package: isQaApk ? 'com.asfion.app.qa' : base.android.package,
    },
    extra: {
      ...base.extra,
      appVariant: isQa ? 'qa' : 'production',
    },
  };
};
