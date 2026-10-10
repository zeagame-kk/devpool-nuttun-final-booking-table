import { describe, expect, it } from "vitest";
import { displayName, firstName, initials } from "@/lib/user";

describe("displayName", () => {
  it("uses the name", () => {
    expect(displayName({ name: "สมชาย ใจดี", email: "somchai@example.com" })).toBe("สมชาย ใจดี");
  });

  it("falls back to the email when there is no name or it is blank", () => {
    expect(displayName({ email: "somchai@example.com" })).toBe("somchai@example.com");
    expect(displayName({ name: "   ", email: "somchai@example.com" })).toBe("somchai@example.com");
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("alice bob carol")).toBe("AB");
    expect(initials("สมชาย ใจดี")).toBe("สจ");
  });

  it("uses one letter for one word", () => {
    expect(initials("alice")).toBe("A");
  });

  it("skips a leading Thai vowel sign that is written before the consonant", () => {
    expect(initials("เจ้าของ")).toBe("จ");
    expect(initials("แพรวา ใจดี")).toBe("พจ");
  });

  it("copes with extra spaces and an empty name", () => {
    expect(initials("  alice   bob ")).toBe("AB");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("works on an email address too, with its first letter", () => {
    expect(initials("somchai@example.com")).toBe("S");
  });
});

describe("firstName", () => {
  it("is the first word of the name", () => {
    expect(firstName("สมศรี ใจดี")).toBe("สมศรี");
    expect(firstName("  alice   bob ")).toBe("alice");
  });

  it("is the part before the @ when the name is an email address", () => {
    expect(firstName("somchai@example.com")).toBe("somchai");
  });

  it("is empty for an empty name", () => {
    expect(firstName("")).toBe("");
  });
});
