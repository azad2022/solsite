import fs from 'node:fs';

const file = 'src/components/AppFeaturesSection.tsx';
let source = fs.readFileSync(file, 'utf8');

const startMarker = '<AnimatePresence>{selectedFeature&&<motion.div';
const start = source.indexOf(startMarker);
if (start < 0) {
  if (source.includes('data-app-features-modal-fixed="true"')) process.exit(0);
  throw new Error('[app-features-modal] modal start marker not found');
}

const endMarker = '</AnimatePresence>';
const end = source.indexOf(endMarker, start);
if (end < 0) throw new Error('[app-features-modal] modal end marker not found');

const modal = source.slice(start, end + endMarker.length);
source = source.slice(0, start) + source.slice(end + endMarker.length);

const sectionEnd = '</div></section>;';
const sectionEndIndex = source.lastIndexOf(sectionEnd);
if (sectionEndIndex < 0) throw new Error('[app-features-modal] section end marker not found');

const replacement = `</div></section><div data-app-features-modal-fixed="true">${modal}</div></>;`;
source = source.slice(0, sectionEndIndex) + replacement + source.slice(sectionEndIndex + sectionEnd.length);

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [app-features-modal] moved the feature modal outside the section containment subtree.');
