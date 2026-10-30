import { describe, expect, it } from "vitest";
import { detectImage } from "./upload.js";

describe("detectImage", () => {
  it("accepts JPEG magic bytes", () => {
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
  });
  it("accepts PNG magic bytes", () => {
    expect(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))?.ext).toBe("png");
  });
  it("rejects executables and HTML", () => {
    expect(detectImage(Buffer.from("MZ"))).toBeNull();
    expect(detectImage(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
