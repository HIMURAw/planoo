import { describe, expect, it } from "vitest";
import { isGenericFigmaName, jaccardSimilarity, tokenize } from "./normalize";

describe("tokenize", () => {
  it("splits camelCase", () => {
    expect(tokenize("userEmail")).toEqual(["user", "email"]);
  });

  it("splits snake_case", () => {
    expect(tokenize("user_email")).toEqual(["user", "email"]);
  });

  it("splits kebab-case", () => {
    expect(tokenize("user-email")).toEqual(["user", "email"]);
  });

  it("splits plain spaces and normalizes case", () => {
    expect(tokenize("User Email")).toEqual(["user", "email"]);
  });

  it("handles a single word", () => {
    expect(tokenize("email")).toEqual(["email"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("isGenericFigmaName", () => {
  it.each([
    "Frame 42",
    "Rectangle Copy 3",
    "Group 17",
    "Ellipse 5",
    "Vector",
    "Component 1",
    "Instance",
  ])("flags auto-named layer %s as generic", (name) => {
    expect(isGenericFigmaName(name)).toBe(true);
  });

  it.each(["email", "userEmail", "Submit Button", "Contact Form"])(
    "does not flag a meaningfully-named layer %s",
    (name) => {
      expect(isGenericFigmaName(name)).toBe(false);
    },
  );
});

describe("jaccardSimilarity", () => {
  it("is 1 for identical token sets", () => {
    expect(jaccardSimilarity(["user", "email"], ["user", "email"])).toBe(1);
  });

  it("is 0 for disjoint token sets", () => {
    expect(jaccardSimilarity(["user", "email"], ["order", "total"])).toBe(0);
  });

  it("is 0 when either side is empty", () => {
    expect(jaccardSimilarity([], ["email"])).toBe(0);
    expect(jaccardSimilarity(["email"], [])).toBe(0);
  });

  it("computes partial overlap correctly", () => {
    // intersection {user} = 1, union {user, email, id} = 3
    expect(jaccardSimilarity(["user", "email"], ["user", "id"])).toBeCloseTo(1 / 3);
  });
});
