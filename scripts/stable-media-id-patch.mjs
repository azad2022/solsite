import fs from 'node:fs';
const path = 'functions/api/media/[action].ts';
if (!fs.existsSync(path)) throw new Error('[stable-media-id] Missing media gateway');
let s = fs.readFileSync(path, 'utf8');
if (!s.includes('async function stableMediaId')) {
  const anchor = "const actionFor(action: string) {";
  const insert = `async function stableMediaId(publicUrl: string, fallback: string): Promise<string> {\n  const value = String(publicUrl || fallback || '').trim();\n  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));\n  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');\n  return 'media_' + hex;\n}\n\n`;
  const idx = s.indexOf(anchor);
  if (idx < 0) throw new Error('[stable-media-id] insertion anchor not found');
  s = s.slice(0, idx) + insert + s.slice(idx);
}
const needle = "    return jsonResponse(data || { success: true }, 200);";
if (!s.includes("normalizedData")) {
  const replacement = `    let normalizedData: any = data || { success: true };\n    if (action === 'assets' && Array.isArray(normalizedData?.assets)) {\n      normalizedData = { ...normalizedData, assets: await Promise.all(normalizedData.assets.map(async (asset: any) => ({ ...asset, id: await stableMediaId(asset?.publicUrl, asset?.path) }))) };\n    }\n    return jsonResponse(normalizedData, 200);`;
  s = s.replace(needle, replacement);
}
fs.writeFileSync(path, s, 'utf8');
console.log('✓ [stable-media-id] Media gateway now exposes deterministic asset IDs.');
