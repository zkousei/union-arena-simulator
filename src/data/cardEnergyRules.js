const colors = { 赤: 'RED', 青: 'BLUE', 黄: 'YELLOW', 緑: 'GREEN', 紫: 'PURPLE' };
const labels = { RED: '赤', BLUE: '青', YELLOW: '黄', GREEN: '緑', PURPLE: '紫', COLORLESS: '無色' };

// Preserve the order of the official requirement text; do not infer generated energy.
export function parseRequiredEnergyColors(text) {
  if (!/[／/]/.test(text)) return undefined;
  return text.match(/[赤青黄緑紫]/g)?.map(color => colors[color]);
}
export function isRequiredEnergyColors(value) {
  return value === undefined || (Array.isArray(value) && value.length >= 2 && value.length <= 5 &&
    value.every(color => Object.values(colors).includes(color)) && new Set(value).size === value.length);
}
export function getRequiredEnergyColors(card) {
  return card.reqEnergyColors ?? [card.color];
}
export function formatRequiredEnergyColors(card) {
  return getRequiredEnergyColors(card).map(color => labels[color]).join('／');
}
