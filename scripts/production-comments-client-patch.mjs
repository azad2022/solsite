import fs from 'node:fs';

const filePath = new URL('../src/utils/cmsApiClient.ts', import.meta.url);
let source = fs.readFileSync(filePath, 'utf8');
const original = source;

source = source.replace(
  /export async function deleteCommentApi\(commentId: string\): Promise<boolean> \{([\s\S]*?)headers: \{ 'Content-Type': 'application\/json' \},([\s\S]*?)body: JSON\.stringify\(\{ commentId \}\)/,
  (_match, before, after) => `export async function deleteCommentApi(commentId: string): Promise<boolean> {${before}headers: getAuthHeaders(),${after}body: JSON.stringify({ commentId })`
);

if (source === original) {
  throw new Error('deleteCommentApi patch target was not found');
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Production comments client patch applied.');
