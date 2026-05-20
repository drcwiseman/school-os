import { describe, it, expect } from "vitest";
import { evaluateFeatureAccess } from "./plan-features";

describe("evaluateFeatureAccess", () => {
  it("allows tenant override when platform enabled despite plan off", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { portal_enabled: true },
        planFlags: { messaging_enabled: true, portal_enabled: false },
        featureCode: "portal_enabled",
        addonAllowed: true,
      }),
    ).toBe(true);
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

  it("denies when not on plan and tenant unset", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: {},
        planFlags: { students: true },
        featureCode: "library",
        addonAllowed: true,
      }),
    ).toBe(false);
  });

  it("denies when tenant explicitly disabled", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { students: false },
        planFlags: { students: true },
        featureCode: "students",
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

  it("defaults to allow when no plan and tenant unset", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: {},
        planFlags: null,
        featureCode: "students",
        addonAllowed: true,
      }),
    ).toBe(true);
  });

  it("denies when addon not allowed", () => {
    expect(
      evaluateFeatureAccess({
        tenantFlags: { ai_homework: true },
        planFlags: { ai_homework: true },
        featureCode: "ai_homework",
        addonAllowed: false,
      }),
    ).toBe(false);
  });
});
