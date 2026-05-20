import { describe, it, expect } from "vitest";
import { evaluateFeatureAccess } from "./plan-features";

describe("evaluateFeatureAccess", () => {
  it("denies when not on plan (strict plan mode)", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { portal_enabled: true },
        planFlags: { messaging_enabled: true, portal_enabled: false },
        featureCode: "portal_enabled",
        addonAllowed: true,
      }),
    ).toBe(false);
  });

  it("allows when explicitly true on plan", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: {},
        planFlags: { custom_smtp: true },
        featureCode: "custom_smtp",
        addonAllowed: true,
      }),
    ).toBe(true);
  });

  it("denies missing plan key (not subscribed to feature)", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { library: true },
        planFlags: { students: true },
        featureCode: "library",
        addonAllowed: true,
      }),
    ).toBe(false);
  });

  it("uses tenant flags when no plan assigned", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { students: true, library: false },
        planFlags: null,
        featureCode: "students",
        addonAllowed: true,
      }),
    ).toBe(true);
    expect(
      evaluateFeatureAccess({
        tenantFlags: { students: true, library: false },
        planFlags: null,
        featureCode: "library",
        addonAllowed: true,
      }),
    ).toBe(false);
  });

  it("denies when addon not allowed", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: {},
        planFlags: { ai_homework: true },
        featureCode: "ai_homework",
        addonAllowed: false,
      }),
    ).toBe(false);
  });
});
