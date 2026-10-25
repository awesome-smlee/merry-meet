import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ANIMAL_AVATARS, animalAvatar } from '../lib/avatars.mjs';

test('animal avatars are local, stable per member and cover all twelve designs', async () => {
  assert.equal(ANIMAL_AVATARS.length, 12);
  assert.equal(animalAvatar('member-1'), animalAvatar('member-1'));
  const assigned = new Set(Array.from({ length: 1000 }, (_, i) => animalAvatar(`member-${i}`)));
  assert.equal(assigned.size, ANIMAL_AVATARS.length);
  for (const name of ANIMAL_AVATARS) {
    const svg = await readFile(new URL(`../public/avatars/${name}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /viewBox="0 0 80 80"/);
    assert.doesNotMatch(svg, /<script|https?:\/\/(?!www\.w3\.org)/);
  }
});
