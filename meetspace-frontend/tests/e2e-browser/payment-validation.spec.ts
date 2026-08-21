import { expect, test } from "@playwright/test";
import {
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidExpiry,
} from "../../src/utils/paymentValidation";

test("local payment fields normalize user input", () => {
  expect(formatCardNumber("4242-4242 abc 4242 4242 999")).toBe("4242 4242 4242 4242 999");
  expect(formatExpiry("12 / 29 extra")).toBe("12/29");
});

test("local payment validation rejects malformed or expired details", () => {
  expect(isValidCardNumber("4242 4242 4242 4242")).toBe(true);
  expect(isValidCardNumber("4242 4242 4242 4241")).toBe(false);
  expect(isValidExpiry("08/26", new Date("2026-08-01T00:00:00Z"))).toBe(true);
  expect(isValidExpiry("07/26", new Date("2026-08-01T00:00:00Z"))).toBe(false);
  expect(isValidExpiry("13/29", new Date("2026-08-01T00:00:00Z"))).toBe(false);
});
