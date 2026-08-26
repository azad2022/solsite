import fs from 'node:fs';

const file = 'src/components/AdminCmsModal.tsx';
let s = fs.readFileSync(file, 'utf8');

// Keep the generated component source normalized across production builds.
const componentFile = 'src/components/MediaLibraryCoverAssignment.tsx';
let component = fs.readFileSync(componentFile, 'utf8');
component = component.replace('/^image\\\\//i', '/^image\\//i');
component = component.replace('/\\\\.(avif|gif|jpe?g|png|svg|webp)$/i', '/\\.(avif|gif|jpe?g|png|svg|webp)$/i');
fs.writeFileSync(componentFile, component, 'utf8');

// Idempotent: once the component has been inserted, leave the Admin modal source untouched.
if (s.includes('data-production-cover-assignment')) process.exit(0);

if (!s.includes("import { MediaLibraryCoverAssignment } from './MediaLibraryCoverAssignment';")) {
  const reactImport = "import React, { useState, useEffect } from 'react';";
  if (!s.includes(reactImport)) throw new Error('ADMIN_MODAL_REACT_IMPORT_NOT_FOUND');
  s = s.replace(reactImport, `${reactImport}\nimport { MediaLibraryCoverAssignment } from './MediaLibraryCoverAssignment';`);
}

const tabMarker = '            {/* TAB 4: GITHUB MEDIA MANAGEMENT */}';
const openMarker = "            {adminTab === 'media' && (\n              <div className=\"space-y-6 text-xs\">";
const start = s.indexOf(tabMarker);
const open = s.indexOf(openMarker, start);

if (start < 0 || open < 0) throw new Error('MEDIA_TAB_NOT_FOUND');

const insertAt = open + openMarker.length;
const componentMarkup = `\n                <MediaLibraryCoverAssignment />`;
s = s.slice(0, insertAt) + componentMarkup + s.slice(insertAt);

fs.writeFileSync(file, s, 'utf8');
console.log('media-library-cover-assignment: image grid + category default assignment UI wired into the canonical media management tab.');
