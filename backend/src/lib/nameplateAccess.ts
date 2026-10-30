import { prisma } from "./prisma.js";
import {
  EMBLEM_DEFS,
  FRAME_DEFS,
  NAME_EMBLEMS,
  NAME_FRAMES,
  emblemRequirement,
  frameRequirement,
  isEmblemUnlocked,
  isFrameUnlocked,
  parseCsv,
  parseMembership,
  parseNameEmblem,
  parseNameFrame,
  parseUnlocks,
  type NameEmblem,
  type NameFrame,
  type NameUnlocks,
} from "../../../src/lib/nameplate.ts";

const FRAME_KEY = "disabled_name_frames";
const EMBLEM_KEY = "disabled_name_emblems";

export async function loadDisabledNameplate() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [FRAME_KEY, EMBLEM_KEY] } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    frames: parseCsv(map.get(FRAME_KEY)).filter((id) => NAME_FRAMES.includes(id as NameFrame) && id !== "none"),
    emblems: parseCsv(map.get(EMBLEM_KEY)).filter((id) => NAME_EMBLEMS.includes(id as NameEmblem) && id !== "none"),
  };
}

export async function saveDisabledNameplate(frames: string[], emblems: string[]) {
  const frameValue = frames.filter((id) => NAME_FRAMES.includes(id as NameFrame) && id !== "none").join(",");
  const emblemValue = emblems.filter((id) => NAME_EMBLEMS.includes(id as NameEmblem) && id !== "none").join(",");
  await Promise.all([
    prisma.setting.upsert({
      where: { key: FRAME_KEY },
      create: { key: FRAME_KEY, value: frameValue },
      update: { value: frameValue },
    }),
    prisma.setting.upsert({
      where: { key: EMBLEM_KEY },
      create: { key: EMBLEM_KEY, value: emblemValue },
      update: { value: emblemValue },
    }),
  ]);
}

export function nameplateCatalog(input: {
  role: string;
  membership: string;
  extra: unknown;
  frame: unknown;
  emblem: unknown;
  disabled: { frames: string[]; emblems: string[] };
}) {
  const membership = parseMembership(input.membership);
  const extra = parseUnlocks(input.extra);
  const frame = parseNameFrame(input.frame);
  const emblem = parseNameEmblem(input.emblem);
  const frames = NAME_FRAMES.map((id) => {
    const unlocked = isFrameUnlocked({ frame: id, membership, extra, disabled: input.disabled.frames });
    return {
      id,
      label: FRAME_DEFS[id].label,
      requirement: frameRequirement(id),
      unlocked,
      disabled: id !== "none" && input.disabled.frames.includes(id),
      equipped: frame === id,
    };
  });
  const emblems = NAME_EMBLEMS.map((id) => {
    const unlocked = isEmblemUnlocked({
      emblem: id,
      membership,
      role: input.role,
      extra,
      disabled: input.disabled.emblems,
    });
    return {
      id,
      label: EMBLEM_DEFS[id].label,
      requirement: emblemRequirement(id),
      unlocked,
      disabled: id !== "none" && input.disabled.emblems.includes(id),
      equipped: emblem === id,
    };
  });
  return { membership, frame, emblem, extra, frames, emblems };
}

export function canEquipFrame(frame: NameFrame, membership: string, extra: NameUnlocks, disabled: string[]) {
  return isFrameUnlocked({ frame, membership: parseMembership(membership), extra, disabled });
}

export function canEquipEmblem(
  emblem: NameEmblem,
  membership: string,
  role: string,
  extra: NameUnlocks,
  disabled: string[],
) {
  return isEmblemUnlocked({ emblem, membership: parseMembership(membership), role, extra, disabled });
}
