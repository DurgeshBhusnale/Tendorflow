const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

/** Renders an ISO-8601 (UTC) timestamp in Asia/Kolkata, per PRD §5. */
export function formatDate(isoTimestamp: string): string {
  return dateFormatter.format(new Date(isoTimestamp));
}

/** Formats a decimal string (the API returns money as strings) as INR. */
export function formatCurrency(amount: string | number): string {
  return currencyFormatter.format(typeof amount === "string" ? Number(amount) : amount);
}
