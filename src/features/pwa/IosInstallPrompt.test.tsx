import { afterEach, describe, expect, it } from "vitest";
import { isIosSafari } from "./IosInstallPrompt";

// Helper: override the read-only navigator fields for one case.
function stubNavigator(over: { userAgent?: string; platform?: string; maxTouchPoints?: number }) {
  Object.defineProperty(navigator, "userAgent", { value: over.userAgent ?? "", configurable: true });
  Object.defineProperty(navigator, "platform", { value: over.platform ?? "", configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: over.maxTouchPoints ?? 0, configurable: true });
}

const ORIGINAL = {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
};

afterEach(() => stubNavigator(ORIGINAL));

describe("isIosSafari", () => {
  it("is true for iPhone Safari", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    });
    expect(isIosSafari()).toBe(true);
  });

  it("is true for iPadOS 13+ (reports as MacIntel with touch)", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });
    expect(isIosSafari()).toBe(true);
  });

  it("is false for iOS Chrome (CriOS)", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    });
    expect(isIosSafari()).toBe(false);
  });

  it("is false for desktop Chrome", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      platform: "Win32",
    });
    expect(isIosSafari()).toBe(false);
  });

  it("is false for a real Mac (MacIntel, no touch)", () => {
    stubNavigator({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    });
    expect(isIosSafari()).toBe(false);
  });
});
