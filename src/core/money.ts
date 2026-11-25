/** Работа с деньгами: все суммы в БД — целые центы USD. */

export type Cents = number;

export function centsToUsd(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

export function formatUsd(cents: Cents): string {
  return `$${centsToUsd(cents)}`;
}

export function formatUsdCompact(cents: Cents): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${centsToUsd(cents)}`;
}

/** Округление розничной цены: до «красивых» значений .99/.00 при расчёте от наценки. */
export function priceFromWholesale(wholesale: Cents, markupPercent: number, minMarginCents: number): Cents {
  const base = Math.ceil(wholesale * (1 + markupPercent / 100));
  const margin = base - wholesale;
  const withMinMargin = Math.max(base, wholesale + minMarginCents);
  if (margin < minMarginCents) return withMinMargin;
  return base;
}

/** Приводит цену к психологическому виду: .99 если отклонение от него <= 30 центов. */
export function charmPrice(cents: Cents): Cents {
  const rem = cents % 100;
  if (rem === 99 || rem === 0) return cents;
  if (rem >= 70 && rem <= 99) return cents - rem + 99;
  if (rem <= 30) return cents - rem;
  return cents;
}

export function dataLabel(dataMb: number): string {
  if (dataMb >= 1024) {
    const gb = dataMb / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${dataMb} MB`;
}

export function validityLabel(days: number): string {
  if (days === 365) return "1 год";
  if (days >= 30 && days % 30 === 0) return `${days / 30} мес`;
  return `${days} дн`;
}
