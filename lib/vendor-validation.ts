export const ACCOUNT_NUMBER_REGEX = /^\d{1,10}$/;

export const ACCOUNT_NUMBER_ERROR_MESSAGE =
  "Account Number must contain digits only and must not exceed 10 digits.";

export function isValidAccountNumber(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  return ACCOUNT_NUMBER_REGEX.test(value);
}
