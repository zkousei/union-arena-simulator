// Product prefixes such as UAPR/UAPB are not action-point card numbers.
export function isActionPointCardNumber(code) {
  const number = code.trim().split('/').pop();
  return /(?:^|[-_])AP\d+(?:[★☆]|_p\d+)*$/i.test(number);
}

export function parseCardCategory(category) {
  const value = category.trim().toUpperCase();
  if (value.includes('キャラクター') || value.includes('CHARACTER')) return 'CHARACTER';
  if (value.includes('イベント') || value.includes('EVENT')) return 'EVENT';
  if (value.includes('フィールド') || value.includes('FIELD')) return 'FIELD';
  if (value.includes('アクションポイント') || /\bACTION[ _]?POINT\b|\bAP\b/.test(value)) return 'ACTION_POINT';
  return null;
}

export function inferCardType(category, code) {
  const parsed = parseCardCategory(category);
  return parsed || (isActionPointCardNumber(code) ? 'ACTION_POINT' : 'CHARACTER');
}

// Official text explicitly lists CHARACTER with BP "-" for this exact printing.
// Preserve the text instead of inferring a category or BP from artwork/other versions.
// https://www.unionarena-tcg.com/jp/cardlist/detail.php?card_no=UAPR%2FHTR-1-026
export function hasReviewedOfficialBpDash(code) {
  return code === 'UAPR/HTR-1-026';
}
