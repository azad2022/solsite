import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';
import { TAG_SEO } from '../src/config/tagSeo';
import { generateSlugFromTitle } from '../src/utils/slugUtils';

test('curated tag SEO keys use canonical generated slugs', () => {
  const canonicalTagNames = [
    'بیتکوین',
    'ساخت میم کوین',
    'میم کوین جدید',
    'کیف پول غیرامانی',
    'پراپ تریدینگ',
    'قیمت سولانا',
    'استیکینگ سولانا',
  ];

  for (const name of canonicalTagNames) {
    const slug = generateSlugFromTitle(name);
    assert.ok(TAG_SEO[slug], `${name} must have curated SEO config at slug ${slug}`);
  }

  for (const slug of Object.keys(TAG_SEO)) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid tag SEO slug: ${slug}`);
  }
});

test('curated tag SEO does not reuse category-only slug definitions', () => {
  for (const slug of Object.keys(TAG_SEO)) {
    assert.notEqual(slug, CATEGORY_SLUGS[slug], `Unexpected category slug collision for ${slug}`);
  }
});
