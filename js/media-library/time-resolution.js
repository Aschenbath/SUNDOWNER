const EXIF_TIME_KEYS = [
  'dateTime',
  'DateTimeOriginal',
  'dateTimeOriginal',
  'DateTimeDigitized',
  'dateTimeDigitized',
  'CreateDate',
  'createDate'
];

const TOP_LEVEL_TIME_KEYS = [
  'TakenAt',
  'takenAt',
  'DateTaken',
  'dateTaken',
  'DateTimeOriginal',
  'dateTimeOriginal',
  'DateTimeDigitized',
  'dateTimeDigitized',
  'CreateDate',
  'createDate',
  'CreationTime',
  'creationTime',
  'ShotAt',
  'shotAt'
];

function isValidDateParts(year, month, day, hours = 0, minutes = 0, seconds = 0) {
  return year >= 1900
    && month >= 1 && month <= 12
    && day >= 1 && day <= 31
    && hours >= 0 && hours <= 23
    && minutes >= 0 && minutes <= 59
    && seconds >= 0 && seconds <= 59;
}

function buildLocalTimestamp(yearText, monthText, dayText, hourText = '0', minuteText = '0', secondText = '0') {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  const seconds = Number(secondText);
  if (!isValidDateParts(year, month, day, hours, minutes, seconds)) {
    return NaN;
  }
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date.getTime()
    : NaN;
}

function parseExifStyleTimestamp(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return NaN;
  }

  const match = normalized.match(
    /^(\d{4})[:/.-](\d{2})[:/.-](\d{2})(?:[ T_](\d{2})[:.-](\d{2})(?:[:.-](\d{2}))?)?$/
  );
  if (!match) {
    return NaN;
  }

  return buildLocalTimestamp(
    match[1],
    match[2],
    match[3],
    match[4] || '0',
    match[5] || '0',
    match[6] || '0'
  );
}

function parseCommonFilenameTimestamp(reference) {
  const normalized = String(reference || '').trim();
  if (!normalized) {
    return NaN;
  }

  const compactMatch = normalized.match(
    /(?:^|[^\d])(?:IMG|PXL|MVIMG|VID|Screenshot|Photo|Scan|Camera)?[_-]?(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?:\d{1,3})?(?=[^\d]|$)/i
  );
  if (compactMatch) {
    return buildLocalTimestamp(
      compactMatch[1],
      compactMatch[2],
      compactMatch[3],
      compactMatch[4],
      compactMatch[5],
      compactMatch[6]
    );
  }

  const separatedMatch = normalized.match(
    /(?:^|[^\d])(20\d{2})[-_.](\d{2})[-_.](\d{2})(?:[ T_-](\d{2})[-_.:](\d{2})(?:[-_.:](\d{2}))?)?(?=[^\d]|$)/
  );
  if (separatedMatch) {
    return buildLocalTimestamp(
      separatedMatch[1],
      separatedMatch[2],
      separatedMatch[3],
      separatedMatch[4] || '12',
      separatedMatch[5] || '0',
      separatedMatch[6] || '0'
    );
  }

  return NaN;
}

function parseUnixTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return NaN;
  }

  const normalized = String(Math.trunc(value));
  if (normalized.length === 10) {
    return value * 1000;
  }
  if (normalized.length === 13) {
    return value;
  }
  return NaN;
}

export function parseLooseCaptureTimestamp(value) {
  if (value == null) {
    return NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return parseUnixTimestamp(value);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return NaN;
  }

  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    const unixTimestamp = parseUnixTimestamp(numeric);
    if (Number.isFinite(unixTimestamp)) {
      return unixTimestamp;
    }
  }

  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return parseExifStyleTimestamp(normalized);
}

export function resolveMediaCaptureTimestamp(metadata, reference = '') {
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};
  const exif = safeMetadata.Exif && typeof safeMetadata.Exif === 'object' ? safeMetadata.Exif : null;

  if (exif) {
    for (const key of EXIF_TIME_KEYS) {
      const timestamp = parseLooseCaptureTimestamp(exif[key]);
      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }
  }

  for (const key of TOP_LEVEL_TIME_KEYS) {
    const timestamp = parseLooseCaptureTimestamp(safeMetadata[key]);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  const filenameTimestamp = parseCommonFilenameTimestamp(safeMetadata.FileName || reference);
  if (Number.isFinite(filenameTimestamp)) {
    return filenameTimestamp;
  }

  return NaN;
}
