const base = require('./app.json').expo;

module.exports = () => {
  const isQa = process.env.APP_VARIANT === 'qa';

  return {
    ...base,
    name: isQa ? 'ASFION QA' : base.name,
    scheme: isQa ? 'asfion-qa' : base.scheme,
    ios: {
      ...base.ios,
      bundleIdentifier: isQa ? 'com.asfion.app.qa' : base.ios.bundleIdentifier,
    },
    android: {
      ...base.android,
      package: isQa ? 'com.asfion.app.qa' : base.android.package,
    },
    extra: {
      ...base.extra,
      appVariant: isQa ? 'qa' : 'production',
    },
  };
};
