import type { Gender, HairStyle } from "../../../shared/src";

// Humanoid sprite templates, 12x16: head (7 rows), body (6), legs (3). Hair styles swap the
// head rows (and, for long hair and ponytails, a row or two of the body); women get a
// narrower waist and lips. Legend: k outline, e eye, h hair, S scalp (bald: skin, but helmets
// and hoods cover it like hair), s skin, r lips, t tunic, d tunic shade, p trousers, b boots.

interface HeadSet {
  down: string[];
  up: string[];
  side: string[];
  /** Replaces the first body rows when seen from the front / back / side. */
  bodyDown?: string[];
  bodyUp?: string[];
  bodySide?: string[];
}

const SHORT: HeadSet = {
  down: ["...kkkkkk...", "..khhhhhhk..", ".khhhhhhhhk.", ".khsssssshk.", ".ksessssesk.", ".kssssssssk.", "..kssssssk.."],
  up: ["...kkkkkk...", "..khhhhhhk..", ".khhhhhhhhk.", ".khhhhhhhhk.", ".khhhhhhhhk.", ".kshhhhhhsk.", "..kssssssk.."],
  side: ["....kkkkk...", "...khhhhhk..", "..khhhhhhhk.", "..khhssssk..", "..khsssesk..", "..kssssssk..", "...kssssk..."],
};

const withRows = (rows: string[], changes: Record<number, string>) => rows.map((row, i) => changes[i] ?? row);

const HEADS: Record<HairStyle, HeadSet> = {
  short: SHORT,
  spiky: {
    down: withRows(SHORT.down, { 0: "..khkhhkhk..", 1: ".khhhhhhhhk." }),
    up: withRows(SHORT.up, { 0: "..khkhhkhk..", 1: ".khhhhhhhhk." }),
    side: withRows(SHORT.side, { 0: "...khkhkhk..", 1: "..khhhhhhk.." }),
  },
  long: {
    down: withRows(SHORT.down, { 3: "khhsssssshhk", 4: "khsesssseshk", 5: "khsssssssshk", 6: ".hksssssskh." }),
    up: withRows(SHORT.up, { 5: "khhhhhhhhhhk", 6: ".hkhhhhhhkh." }),
    side: withRows(SHORT.side, { 4: ".khhsssesk..", 5: ".khssssssk..", 6: "..khssssk..." }),
    bodyDown: ["hkdttttttdkh"],
    bodyUp: ["hkdhhhhhhdkh", "khhhhhhhhhhk"],
    bodySide: ["..khttttdk.."],
  },
  ponytail: {
    down: SHORT.down,
    up: withRows(SHORT.up, { 6: "..ksshhssk.." }),
    side: withRows(SHORT.side, { 4: ".hkhsssesk..", 5: "khkssssssk.." }),
    bodyUp: [".kdtthhttdk.", "ksttthhtttsk"],
  },
  bun: {
    down: withRows(SHORT.down, { 0: "....khhk....", 1: "..kkhhhhkk..", 2: ".khhhhhhhhk." }),
    up: withRows(SHORT.up, { 0: "....khhk....", 1: "..kkhhhhkk..", 2: ".khhhhhhhhk." }),
    side: withRows(SHORT.side, { 0: "..khhkkkk...", 1: "..khhhhhhk.." }),
  },
  bald: {
    down: withRows(SHORT.down, { 1: "..kSSSSSSk..", 2: ".kSSSSSSSSk.", 3: ".kSssssssSk." }),
    up: ["...kkkkkk...", "..kSSSSSSk..", ".kSSSSSSSSk.", ".kSSSSSSSSk.", ".kSSSSSSSSk.", ".kSSSSSSSSk.", "..kssssssk.."],
    side: withRows(SHORT.side, { 1: "...kSSSSSk..", 2: "..kSSSSSSSk.", 3: "..kSSssssk..", 4: "..kSsssesk.." }),
  },
};

const BODY_FRONT = [".kdttttttdk.", "ksttttttttsk", "ksdttttttdsk", ".kdttttttdk.", ".kddddddddk.", "..kppkkppk.."];
/** A narrower waist. */
const BODY_FRONT_FEMALE = withRows(BODY_FRONT, { 3: "..kdttttdk.." });
const BODY_SIDE = ["..kdttttdk..", "..kttttttk..", "..ktttsttk..", "..kdttttdk..", "..kddddddk..", "...kppppk..."];
const BODY_SIDE_FEMALE = withRows(BODY_SIDE, { 3: "...kdttdk..." });

const LEGS_FRONT = [
  ["..kppkkppk..", "..kbbkkbbk..", "..kkk..kkk.."],
  ["..kppkkppk..", "..kkk.kbbk..", ".......kkk.."],
  ["..kppkkppk..", "..kbbk.kkk..", "..kkk......."],
];
const LEGS_SIDE = [
  ["...kpppk....", "...kbbbk....", "...kkkkk...."],
  ["..kppkppk...", ".kbbk..kbbk.", ".kkk....kkk."],
  ["...kpppk....", "..kbbkbbk...", "..kkk.kkk..."],
];

/** Puts `ch` at column `x` if that pixel is skin. */
const paintAt = (row: string, x: number, ch: string) => (row[x] === "s" ? row.slice(0, x) + ch + row.slice(x + 1) : row);

const cache = new Map<string, string[][]>();

/** 9 frames: down 0-2, up 3-5, side (facing right) 6-8. Frame 0 of each is idle. */
export function humanoidFrames(gender: Gender = "male", hairStyle: HairStyle = "short"): string[][] {
  const key = `${gender}:${hairStyle}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const head = HEADS[hairStyle] ?? SHORT;
  const female = gender === "female";
  let down = head.down;
  let side = head.side;
  if (female) {
    // Lips, below the eyes.
    down = withRows(down, { 5: paintAt(paintAt(down[5], 5, "r"), 6, "r") });
    side = withRows(side, { 5: paintAt(side[5], 8, "r") });
  }
  const front = female ? BODY_FRONT_FEMALE : BODY_FRONT;
  const bodyDown = withRows(front, Object.fromEntries((head.bodyDown ?? []).map((row, i) => [i, row])));
  const bodyUp = withRows(front, Object.fromEntries((head.bodyUp ?? []).map((row, i) => [i, row])));
  const bodySide = withRows(female ? BODY_SIDE_FEMALE : BODY_SIDE, Object.fromEntries((head.bodySide ?? []).map((row, i) => [i, row])));
  const frames = [
    ...LEGS_FRONT.map((legs) => [...down, ...bodyDown, ...legs]),
    ...LEGS_FRONT.map((legs) => [...head.up, ...bodyUp, ...legs]),
    ...LEGS_SIDE.map((legs) => [...side, ...bodySide, ...legs]),
  ];
  cache.set(key, frames);
  return frames;
}
