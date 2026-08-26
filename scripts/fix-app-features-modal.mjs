import fs from 'node:fs';

const file = 'src/components/AppFeaturesSection.tsx';
let source = fs.readFileSync(file, 'utf8');

// Keep the modal in the component tree, but prevent the section from becoming
// a content-visibility containing block for its viewport-fixed dialog.
const fixedMarker = "style={{contentVisibility:'visible'}}";
if (source.includes(fixedMarker)) {
  console.log('✓ [app-features-modal] viewport-safe section already configured.');
  process.exit(0);
}

const marker = 'return <section id="app-features"';
if (!source.includes(marker)) throw new Error('[app-features-modal] section marker not found');
source = source.replace(marker, 'return <section id="app-features" style={{contentVisibility:\'visible\'}}');

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [app-features-modal] disabled content-visibility on the feature section so fixed details stay in the viewport.');
