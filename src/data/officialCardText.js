// Decode after removing HTML tags, so escaped text remains literal card text.
export function decodeCardText(text) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', plus: '+', plusmn: '±' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|plus|plusmn);/gi, (entity, value) => {
    if (!value.startsWith('#')) return named[value.toLowerCase()];
    const point = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}
