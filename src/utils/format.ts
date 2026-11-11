export function formatDateTime(
  isoString: string | null | undefined,
  locale: string,
): { display: string; tooltip: string } {
  if (!isoString) {
    return { display: "—", tooltip: "" };
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return { display: isoString, tooltip: isoString };
  }

  const display = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);

  const tooltip = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);

  return { display, tooltip: `${tooltip} (${isoString})` };
}

export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(1)} °C`;
}

export function formatQuantity(quantity: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(quantity);
}

