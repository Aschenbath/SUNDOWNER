// functions/utils/debounce.js

/**
 * Returns a debounced version of the provided function.
 * The debounced function postpones its execution until after `wait` milliseconds
 * have elapsed since the last time it was invoked.
 * @param {function(...any):any} func - function to debounce
 * @param {number} wait - delay in ms
 * @returns {function(...any):void}
 */
export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
