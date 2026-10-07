// ONE place to control all prices on the site.
// Your price lists stay in USD; this file converts them to FCFA (XAF).

export const USD_TO_XAF = 600;   // change this when the exchange rate changes
export const MARKUP = 1.0;       // 1.0 = no profit added, 1.2 = +20%, 1.5 = +50%

// USD -> XAF number, rounded UP to the nearest 5 XAF
export function toXaf(usd) {
  return Math.ceil((Number(usd) * USD_TO_XAF * MARKUP) / 5) * 5;
}

// 2860 -> "2,860 XAF"
export function formatXAF(xaf) {
  return `${Number(xaf).toLocaleString("en-US")} XAF`;
}

// USD price straight to a label: 4.76 -> "2,860 XAF"
export function priceLabel(usd) {
  return formatXAF(toXaf(usd));
}
