import { describe, expect, it } from "vitest";
import { publicUser } from "./serialize.js";

const row = {
  id: "user_1",
  username: "alicewins",
  email: "alice@example.com",
  displayName: "Alice",
  bio: "hi",
  avatar: "",
  role: "user",
  banned: false,
  createdAt: new Date("2024-01-01"),
  dateOfBirth: new Date("1990-01-01"),
};

describe("publicUser", () => {
  it("hides email and date of birth from other viewers", () => {
    const user = publicUser(row);
    expect(user.email).toBe("");
    expect(user.dateOfBirth).toBeUndefined();
    expect(user.password).toBe("");
  });
  it("returns email only to self", () => {
    expect(publicUser(row, { self: true }).email).toBe("alice@example.com");
  });
});
