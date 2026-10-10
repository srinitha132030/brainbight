const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withBrainbightAccessibility(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) throw new Error('Brainbight: Android manifest application is missing.');
    app.service = app.service || [];
    const className = '.BrainbightAccessibilityService';
    if (!app.service.some((service) => service.$?.['android:name'] === className)) {
      app.service.push({ $: {
        'android:name': className,
        'android:label': 'Brainbight gesture controls',
        'android:description': '@string/brainbight_accessibility_description',
        'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
        'android:exported': 'true',
      }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }] }], meta-data: [{ $: {
        'android:name': 'android.accessibilityservice',
        'android:resource': '@xml/brainbight_accessibility_service',
      } }] });
    }
    return mod;
  });
  config = withDangerousMod(config, ['android', async (mod) => {
    const root = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main');
    const kotlin = path.join(root, 'java', 'com', 'brainbight', 'mobile');
    const resources = path.join(root, 'res', 'xml');
    const values = path.join(root, 'res', 'values');
    fs.mkdirSync(kotlin, { recursive: true }); fs.mkdirSync(resources, { recursive: true }); fs.mkdirSync(values, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'BrainbightAccessibilityService.kt'), path.join(kotlin, 'BrainbightAccessibilityService.kt'));
    fs.copyFileSync(path.join(__dirname, 'BrainbightAccessibilityModule.kt'), path.join(kotlin, 'BrainbightAccessibilityModule.kt'));
    const application = path.join(kotlin, 'MainApplication.kt');
    if (!fs.existsSync(application)) throw new Error('Brainbight: Expo did not generate MainApplication.kt. Check your Android package and Expo prebuild.');
    let source = fs.readFileSync(application, 'utf8');
    if (!source.includes('BrainbightAccessibilityPackage()')) {
      if (!source.includes('PackageList(this).packages.apply {')) throw new Error('Brainbight: cannot find the Expo Android package registration point in MainApplication.kt.');
      source = source.replace(/^package ([^\n]+)$/m, '$&\n\nimport com.brainbight.mobile.BrainbightAccessibilityPackage');
      source = source.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n        add(BrainbightAccessibilityPackage())');
      fs.writeFileSync(application, source);
    }
    fs.copyFileSync(path.join(__dirname, 'brainbight_accessibility_service.xml'), path.join(resources, 'brainbight_accessibility_service.xml'));
    fs.copyFileSync(path.join(__dirname, 'accessibility_strings.xml'), path.join(values, 'brainbight_accessibility_strings.xml'));
    return mod;
  }]);
  return config;
};
