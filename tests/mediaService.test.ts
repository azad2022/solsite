import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateSeoFilename } from '../src/utils/mediaService';

test('generates a stable SEO-friendly filename from Persian text', () => {
  assert.equal(
    generateSeoFilename('تصویر تست مقاله جدید.png'),
    'tsvir-test-mghalh-gdid.webp'
  );
});

test('normalizes separators and removes unsafe characters', () => {
  assert.equal(
    generateSeoFilename('My  Image__01!!.jpg'),
    'my-image-01.webp'
  );
});
