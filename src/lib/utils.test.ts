import { describe, it, expect } from "vitest";
import { formatUnit, formatQuantityWithUnit } from "./utils";

describe("formatUnit", () => {
  it("maps unit codes to short labels", () => {
    expect(formatUnit("KG")).toBe("kg");
    expect(formatUnit("Gram")).toBe("g");
    expect(formatUnit("Litre")).toBe("L");
    expect(formatUnit("ML")).toBe("ml");
    expect(formatUnit("Piece")).toBe("pcs");
    expect(formatUnit("Dozen")).toBe("dozen");
  });
});

describe("formatQuantityWithUnit", () => {
  it("auto-scales base units up when humanizing", () => {
    expect(formatQuantityWithUnit(1000, "Gram")).toBe("1 kg");
    expect(formatQuantityWithUnit(5000, "Gram")).toBe("5 kg");
    expect(formatQuantityWithUnit(2000, "ML")).toBe("2 L");
  });
  it("keeps small quantities in their unit", () => {
    expect(formatQuantityWithUnit(250, "Gram")).toBe("250 g");
    expect(formatQuantityWithUnit(5, "KG")).toBe("5 kg");
  });
  it("respects humanize:false (pack-size display)", () => {
    expect(formatQuantityWithUnit(1000, "Gram", { humanize: false })).toBe("1,000 g");
  });
  it("handles null/undefined", () => {
    expect(formatQuantityWithUnit(null, "Gram")).toBe("—");
    expect(formatQuantityWithUnit(undefined, "KG")).toBe("—");
  });
});
