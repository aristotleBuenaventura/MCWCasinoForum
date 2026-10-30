import { randomBytes } from "node:crypto";

export function uid(prefix = "id") {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}
