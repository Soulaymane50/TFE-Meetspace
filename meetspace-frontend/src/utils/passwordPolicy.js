export const passwordRequirements = [
  {
    key: "minLength",
    test: (value) => (value || "").length >= 8,
  },
  {
    key: "uppercase",
    test: (value) => /[A-Z]/.test(value || ""),
  },
  {
    key: "lowercase",
    test: (value) => /[a-z]/.test(value || ""),
  },
  {
    key: "number",
    test: (value) => /\d/.test(value || ""),
  },
  {
    key: "special",
    test: (value) => /[^A-Za-z0-9]/.test(value || ""),
  },
];

export function getPasswordChecks(password) {
  return passwordRequirements.map((requirement) => ({
    key: requirement.key,
    isValid: requirement.test(password),
  }));
}

export function isStrongPassword(password) {
  return passwordRequirements.every((requirement) => requirement.test(password));
}
