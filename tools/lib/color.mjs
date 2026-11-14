// Color math shared by the token tools: sRGB, WCAG 2.x luminance and contrast,
// OKLab/OKLCH conversion with sRGB gamut clamping, and lightness search.
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
export const hexToOklch = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: Math.atan2(B, A) };
};
const oklchToLinear = ({ L, C, H }) => {
  const A = C * Math.cos(H);
  const B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const inGamut = (lin) => lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4);
export const oklchToHex = (lch) => {
  let C = lch.C;
  while (C > 0 && !inGamut(oklchToLinear({ ...lch, C }))) C -= 0.001; // reduce chroma to fit sRGB
  return rgbToHex(oklchToLinear({ ...lch, C: Math.max(0, C) }).map(toSrgb));
};
// Lightness search: keep H and C, find L whose color has WCAG luminance targetY.
export const atLuminance = (lch, targetY) => {
  let lo = 0, hi = 1, hex = '';
  for (let i = 0; i < 40; i++) {
    const L = (lo + hi) / 2;
    hex = oklchToHex({ ...lch, L });
    if (luminance(hex) > targetY) hi = L; else lo = L;
  }
  return hex;
};

