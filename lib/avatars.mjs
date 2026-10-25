import { avatarSeed } from './meeting.mjs';

export const ANIMAL_AVATARS = ['cat', 'dog', 'bear', 'rabbit', 'fox', 'panda', 'koala', 'pig', 'tiger', 'lion', 'frog', 'penguin'];
export function animalAvatar(id) {
  return `/avatars/${ANIMAL_AVATARS[avatarSeed(String(id || 'guest')) % ANIMAL_AVATARS.length]}.svg`;
}
export function memberAvatar(member) {
  return ANIMAL_AVATARS.includes(member.avatar) ? `/avatars/${member.avatar}.svg` : animalAvatar(member.id);
}
