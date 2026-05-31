/**
 * HTML escape utility for preventing XSS attacks
 * Use this before inserting user-generated content into innerHTML
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text safe for innerHTML
 */
export function escapeHtml(text) {
  if (text == null) {
    return '';
  }
  return String(text).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Escapes HTML but preserves newlines as <br> tags
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text with <br> tags
 */
export function escapeHtmlWithBreaks(text) {
  if (text == null) {
    return '';
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Escapes HTML attributes (for use in attribute values)
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text safe for attributes
 */
export function escapeHtmlAttr(text) {
  if (text == null) {
    return '';
  }
  // For attributes, we need to escape quotes and ampersands
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
