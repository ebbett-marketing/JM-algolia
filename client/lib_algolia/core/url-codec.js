export function safeJSONParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

export function encodeValue(value) {
  if (value == null) return '';
  return encodeURIComponent(String(value).replace(/ /g, '+'));
}

export function decodeValue(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value).replace(/\+/g, ' ');
  } catch (e) {
    console.warn('Error decoding value:', value, e);
    return value;
  }
}
