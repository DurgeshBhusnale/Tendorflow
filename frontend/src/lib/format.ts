const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// Rupees with Indian digit grouping. Whole amounts read as `45,200`; anything
// with paise always shows both decimal places, so money never renders as
// `8,753.5`. Two formatters because Intl fixes the digit count per instance.
const rupeesFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const rupeesAndPaiseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// A bare calendar day has no timezone of its own, so it is formatted as the
// UTC midnight it parses to — shifting it into IST could only ever be wrong.
const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// en-CA formats as YYYY-MM-DD, the shape a date input and the API both use.
const isoDayInIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** Renders an ISO-8601 (UTC) timestamp in Asia/Kolkata, per PRD §5. */
export function formatDate(isoTimestamp: string): string {
  return dateFormatter.format(new Date(isoTimestamp));
}

/** Renders a `YYYY-MM-DD` calendar day (e.g. a tender's date) as `20 Sept 2026`. */
export function formatDay(isoDay: string): string {
  return dayFormatter.format(new Date(`${isoDay}T00:00:00Z`));
}

/** Today's calendar day in IST, as `YYYY-MM-DD` — matches the server's default. */
export function todayInIst(): string {
  return isoDayInIst.format(new Date());
}

/** Formats a decimal string (the API returns money as strings) as INR. */
export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return Number.isInteger(value)
    ? rupeesFormatter.format(value)
    : rupeesAndPaiseFormatter.format(value);
}
