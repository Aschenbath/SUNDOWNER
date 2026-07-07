function isValidIpv4Address(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const number = Number(part);
    return number >= 0 && number <= 255 && String(number) === part;
  });
}

function isValidIpv6Address(value) {
  const normalized = String(value || '').trim();
  if (!normalized.includes(':') || normalized.length > 45 || /[\s\[\]%]/.test(normalized)) {
    return false;
  }
  try {
    new URL(`https://[${normalized}]/`);
    return true;
  } catch {
    return false;
  }
}

export function isValidIpAddress(value) {
  const normalized = String(value || '').trim();
  return isValidIpv4Address(normalized) || isValidIpv6Address(normalized);
}
