// Customisable character: a small, serialisable AvatarSpec that is validated, turned into a drawing recipe,
// and rendered by the same pixel engine as the built-in cast (portraitArt.ts). No images are stored, only the spec.
import {
  composePortraitBuf, composeSceneBufs, PORTRAIT_W, PORTRAIT_H, SCENE_W, SCENE_H,
  type Recipe, type HairStyle, type HairArgs, type Cloth, type Facial, type Brow, type Mouth, type RGB,
} from './portraitArt';

export interface Option { id: string; label: string }
export interface SkinOption extends Option { color: string }
export interface HairOption extends Option { style: HairStyle; args?: HairArgs }

export const SKIN_OPTIONS: SkinOption[] = [
  { id: 'fair', label: 'Fair', color: '#ffdbc4' },
  { id: 'light', label: 'Light', color: '#f7c9aa' },
  { id: 'olive', label: 'Olive', color: '#cca070' },
  { id: 'tan', label: 'Tan', color: '#d6a274' },
  { id: 'bronze', label: 'Bronze', color: '#ac7a54' },
  { id: 'brown', label: 'Brown', color: '#9e704e' },
  { id: 'dark', label: 'Dark', color: '#785038' },
  { id: 'ebony', label: 'Deep', color: '#543628' },
];

export const HAIR_OPTIONS: HairOption[] = [
  { id: 'shortL', label: 'Short, left part', style: 'styleShort', args: { part: 'L' } },
  { id: 'shortR', label: 'Short, right part', style: 'styleShort', args: { part: 'R' } },
  { id: 'receding', label: 'Receding', style: 'styleShort', args: { part: 'L', recede: 1 } },
  { id: 'floppy', label: 'Floppy', style: 'styleFloppy' },
  { id: 'bob', label: 'Bob', style: 'styleFrame', args: { length: 11, vol: 1 } },
  { id: 'shoulder', label: 'Shoulder length', style: 'styleFrame', args: { length: 15, vol: 1 } },
  { id: 'long', label: 'Long', style: 'styleFrame', args: { length: 20, vol: 2 } },
  { id: 'bun', label: 'Bun', style: 'styleBun' },
  { id: 'curly', label: 'Curly', style: 'styleCurly' },
  { id: 'messy', label: 'Messy', style: 'styleMessy', args: { length: 8 } },
  { id: 'shaggy', label: 'Shaggy', style: 'styleMessy', args: { length: 12 } },
  { id: 'spiky', label: 'Spiky', style: 'styleSpiky' },
  { id: 'buzz', label: 'Buzz cut', style: 'styleBuzz' },
  { id: 'mohawk', label: 'Mohawk', style: 'styleMohawk' },
  { id: 'afro', label: 'Afro', style: 'styleAfro' },
  { id: 'ponytail', label: 'Ponytail', style: 'stylePonytail' },
  { id: 'balding', label: 'Balding', style: 'styleRecede' },
  { id: 'bald', label: 'Bald', style: 'styleBald' },
];

export const CLOTH_OPTIONS: Option[] = [
  { id: 'tee', label: 'T-shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'polo', label: 'Polo' },
  { id: 'dressshirt', label: 'Dress shirt' },
  { id: 'suit', label: 'Suit' },
  { id: 'blouse', label: 'Blouse' },
  { id: 'cardigan', label: 'Cardigan' },
  { id: 'sweater', label: 'Sweater' },
];
export const FACIAL_OPTIONS: Option[] = [
  { id: '', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'mustacheSm', label: 'Small moustache' },
  { id: 'mustache', label: 'Moustache' }, { id: 'goatee', label: 'Goatee' },
];
export const BROW_OPTIONS: Option[] = [
  { id: 'flat', label: 'Calm' }, { id: 'soft', label: 'Soft' }, { id: 'raised', label: 'Curious' }, { id: 'angry', label: 'Stern' },
];
export const MOUTH_OPTIONS: Option[] = [
  { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' }, { id: 'neutral', label: 'Neutral' }, { id: 'frown', label: 'Frown' },
];

export const HAIR_COLORS = ['#1c1a1d', '#3a2a1c', '#5c3d22', '#7a3b22', '#b5532a', '#d6b25e', '#e6dcc4', '#9a9aa0', '#e4e4e8', '#3d6fb5', '#d96aa7', '#4aa068', '#7a54b8'];
export const CLOTH_COLORS = ['#3a3f4a', '#5a6b8c', '#6fa8dc', '#4a7ab5', '#9caf88', '#6fae6f', '#4a8a6a', '#b89b3e', '#e0b84a', '#d16ba5', '#b5544a', '#c0392b', '#7a4b6b', '#8572ac', '#f4f1ea', '#2a2a30'];

export interface AvatarSpec {
  v: 1;
  skin: string; hair: string; hairColor: string;
  cloth: string; clothColor: string; accent: string; pants: string;
  facial: string; glasses: boolean; brow: string; mouth: string;
  blush: boolean; lashes: boolean; heavy: boolean;
}

export const DEFAULT_AVATAR: AvatarSpec = {
  v: 1, skin: 'light', hair: 'shortL', hairColor: '#5c3d22', cloth: 'tee', clothColor: '#4a7ab5', accent: '#f4f1ea', pants: '#363846',
  facial: '', glasses: false, brow: 'flat', mouth: 'smile', blush: false, lashes: false, heavy: false,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const ids = (list: Option[]) => new Set(list.map((o) => o.id));
const SKIN_IDS = ids(SKIN_OPTIONS), HAIR_IDS = ids(HAIR_OPTIONS), CLOTH_IDS = ids(CLOTH_OPTIONS);
const FACIAL_IDS = ids(FACIAL_OPTIONS), BROW_IDS = ids(BROW_OPTIONS), MOUTH_IDS = ids(MOUTH_OPTIONS);

/** Turns anything (stored JSON, URL data, user input) into a safe spec. Unknown or invalid fields fall back to defaults. */
export function sanitizeAvatar(input: unknown): AvatarSpec {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick = (value: unknown, allowed: Set<string>, fallback: string) => (typeof value === 'string' && allowed.has(value) ? value : fallback);
  const color = (value: unknown, fallback: string) => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback);
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  const d = DEFAULT_AVATAR;
  return {
    v: 1,
    skin: pick(o.skin, SKIN_IDS, d.skin), hair: pick(o.hair, HAIR_IDS, d.hair), hairColor: color(o.hairColor, d.hairColor),
    cloth: pick(o.cloth, CLOTH_IDS, d.cloth), clothColor: color(o.clothColor, d.clothColor), accent: color(o.accent, d.accent), pants: color(o.pants, d.pants),
    facial: pick(o.facial, FACIAL_IDS, d.facial), glasses: flag(o.glasses, d.glasses),
    brow: pick(o.brow, BROW_IDS, d.brow), mouth: pick(o.mouth, MOUTH_IDS, d.mouth),
    blush: flag(o.blush, d.blush), lashes: flag(o.lashes, d.lashes), heavy: flag(o.heavy, d.heavy),
  };
}

const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export function avatarToRecipe(input: unknown): Recipe {
  const a = sanitizeAvatar(input);
  const hair = HAIR_OPTIONS.find((h) => h.id === a.hair)!;
  const recipe: Recipe = {
    skin: a.skin, hairc: rgb(a.hairColor), hair: hair.style, cloth: a.cloth as Cloth, c1: rgb(a.clothColor),
    pants: rgb(a.pants), brow: a.brow as Brow, mouth: a.mouth as Mouth, blush: a.blush, glasses: a.glasses, lashes: a.lashes, heavy: a.heavy,
  };
  if (hair.args) recipe.hairargs = hair.args;
  if (a.facial) recipe.facial = a.facial as Facial;
  // The accent colour is the tie (suit, dress shirt) or the trim / print colour (polo, cardigan, tee).
  if (a.cloth === 'suit' || a.cloth === 'dressshirt') recipe.tie = rgb(a.accent); else recipe.c2 = rgb(a.accent);
  return recipe;
}

/** 18x28 head-and-shoulders portrait, RGBA. */
export function renderAvatarPortrait(spec: unknown): { w: number; h: number; pixels: Uint8ClampedArray } {
  return { w: PORTRAIT_W, h: PORTRAIT_H, pixels: composePortraitBuf(avatarToRecipe(spec)) };
}
/** 18x32 full-body walking sprite frames (stand, step-left, step-right), front and back. */
export function renderAvatarScene(spec: unknown): { w: number; h: number; front: Uint8ClampedArray[]; back: Uint8ClampedArray[] } {
  const frames = composeSceneBufs(avatarToRecipe(spec));
  return { w: SCENE_W, h: SCENE_H, front: frames.front, back: frames.back };
}

/** A random but sensible character. Pass a seeded function to make it reproducible. */
export function randomAvatar(rng: () => number = Math.random): AvatarSpec {
  const pick = <T,>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  const chance = (p: number) => rng() < p;
  const hair = pick(HAIR_OPTIONS);
  return sanitizeAvatar({
    skin: pick(SKIN_OPTIONS).id, hair: hair.id, hairColor: pick(HAIR_COLORS),
    cloth: pick(CLOTH_OPTIONS).id, clothColor: pick(CLOTH_COLORS), accent: pick(CLOTH_COLORS), pants: pick(['#363846', '#2a2a30', '#4a4f66', '#5c4a3a', '#3d5a4a']),
    facial: chance(0.3) ? pick(FACIAL_OPTIONS.slice(1)).id : '', glasses: chance(0.25),
    brow: pick(BROW_OPTIONS).id, mouth: pick(MOUTH_OPTIONS).id, blush: chance(0.2), lashes: chance(0.25), heavy: chance(0.15),
  });
}
