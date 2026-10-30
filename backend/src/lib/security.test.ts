import { describe, expect, it } from "vitest";
import { ageFromDob, isDisposableEmail, passwordPolicyError } from "./security.js";

describe("passwordPolicyError", () => {
  it("rejects short passwords", () => {
    expect(passwordPolicyError("abc12")).toMatch(/8 characters/);
  });
  it("requires a letter and a number", () => {
    expect(passwordPolicyError("abcdefgh")).toMatch(/letter and a number/);
    expect(passwordPolicyError("12345678")).toMatch(/letter and a number/);
  });
  it("accepts mixed passwords", () => {
    expect(passwordPolicyError("password123")).toBeNull();
  });
});

describe("ageFromDob", () => {
  it("blocks under-18 dates", () => {
    expect(ageFromDob("2018-01-01")).toBeLessThan(18);
  });
});

describe("isDisposableEmail", () => {
  it("flags known disposable domains", () => {
    expect(isDisposableEmail("bot@mailinator.com")).toBe(true);
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
  });
});
