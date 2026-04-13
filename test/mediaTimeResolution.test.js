import assert from 'node:assert/strict';

import {
  parseLooseCaptureTimestamp,
  resolveMediaCaptureTimestamp
} from '../js/media-library/time-resolution.js';

function assertLocalDateParts(timestamp, expected) {
  const date = new Date(timestamp);
  assert.equal(date.getFullYear(), expected.year);
  assert.equal(date.getMonth() + 1, expected.month);
  assert.equal(date.getDate(), expected.day);
  assert.equal(date.getHours(), expected.hours);
  assert.equal(date.getMinutes(), expected.minutes);
  assert.equal(date.getSeconds(), expected.seconds);
}

describe('media time resolution', () => {
  it('parses legacy EXIF timestamps that use colon-separated date segments', () => {
    const timestamp = parseLooseCaptureTimestamp('2024:07:12 18:04:33');

    assertLocalDateParts(timestamp, {
      year: 2024,
      month: 7,
      day: 12,
      hours: 18,
      minutes: 4,
      seconds: 33
    });
  });

  it('prefers legacy EXIF keys over upload timestamp fallback', () => {
    const timestamp = resolveMediaCaptureTimestamp({
      TimeStamp: Date.parse('2026-04-13T09:00:00.000Z'),
      Exif: {
        DateTimeOriginal: '2024:07:12 18:04:33'
      }
    });

    assertLocalDateParts(timestamp, {
      year: 2024,
      month: 7,
      day: 12,
      hours: 18,
      minutes: 4,
      seconds: 33
    });
  });

  it('falls back to common phone filename patterns when EXIF is missing', () => {
    const timestamp = resolveMediaCaptureTimestamp({
      FileName: 'PXL_20240417_162455123.jpg',
      TimeStamp: Date.parse('2026-04-13T09:00:00.000Z')
    });

    assertLocalDateParts(timestamp, {
      year: 2024,
      month: 4,
      day: 17,
      hours: 16,
      minutes: 24,
      seconds: 55
    });
  });

  it('accepts top-level capture fields from older metadata shapes', () => {
    const timestamp = resolveMediaCaptureTimestamp({
      DateTaken: '2025-09-01 15:09:00',
      TimeStamp: Date.parse('2026-04-13T09:00:00.000Z')
    });

    assertLocalDateParts(timestamp, {
      year: 2025,
      month: 9,
      day: 1,
      hours: 15,
      minutes: 9,
      seconds: 0
    });
  });

  it('does not misread compact calendar dates as unix timestamps', () => {
    assert.equal(Number.isNaN(parseLooseCaptureTimestamp('20240417')), true);
  });

  it('still leaves upload timestamp as the final fallback when capture time is unavailable', () => {
    assert.equal(Number.isNaN(resolveMediaCaptureTimestamp({
      FileName: 'tree-photo.jpg',
      TimeStamp: 1710000000
    })), true);
  });
});
