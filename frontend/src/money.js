const WEI_PER_GEN = 1000000000000000000n;
export const BASIS_POINTS_TOTAL = 10000n;

export const parseGenToWei = (genAmountStr) => {
  if (!genAmountStr) return 0n;
  const str = String(genAmountStr).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return 0n;
  const [intPart, fracPartRaw = ''] = str.split('.');
  const fracPart = (fracPartRaw + '0'.repeat(18)).slice(0, 18);
  const wei = BigInt(intPart + fracPart);
  return wei > 0n ? wei : 0n;
};

export const formatWeiToGen = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  let wei;
  try { wei = BigInt(val); } catch { return String(val); }
  if (wei === 0n) return '0';
  const intPart = wei / WEI_PER_GEN;
  const fracPart = wei % WEI_PER_GEN;
  if (fracPart === 0n) return intPart.toString();
  const fracStr = fracPart.toString().padStart(18, '0').replace(/0+$/, '');
  return fracStr.length > 0 ? `${intPart}.${fracStr}` : intPart.toString();
};

export const sanitizeGenInput = (raw) => {
  const str = String(raw ?? '');
  let out = '';
  let seenDot = false;
  let fracCount = 0;
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (fracCount >= 18) continue;
        fracCount += 1;
      }
      out += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      out += ch;
    }
  }
  return out;
};

export const sanitizeBpsInput = (raw) => {
  let digits = '';
  for (const ch of String(raw ?? '')) {
    if (ch >= '0' && ch <= '9') digits += ch;
  }
  if (!digits) return '';
  let n;
  try { n = BigInt(digits); } catch { return ''; }
  if (n > BASIS_POINTS_TOTAL) n = BASIS_POINTS_TOTAL;
  return n.toString();
};

export const toWeiString = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'bigint') return val.toString();
  if (typeof val === 'number') return '0';
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) return '0';
  return str;
};

export const toBpsInt = (val) => {
  if (val === null || val === undefined || val === '') return 0n;
  try {
    const n = BigInt(String(val).replace(/[^0-9]/g, '') || '0');
    if (n < 0n) return 0n;
    if (n > BASIS_POINTS_TOTAL) return BASIS_POINTS_TOTAL;
    return n;
  } catch {
    return 0n;
  }
};

export const computeShareWei = (totalWei, bps) => {
  const total = BigInt(toWeiString(totalWei));
  const points = toBpsInt(bps);
  return (total * points) / BASIS_POINTS_TOTAL;
};

export const remainingShareWei = (totalWei, bps, depositedWei) => {
  const owed = computeShareWei(totalWei, bps);
  const dep = BigInt(toWeiString(depositedWei));
  return owed > dep ? owed - dep : 0n;
};

export const equalBasisPoints = (count) => {
  const n = BigInt(count);
  if (n <= 0n) return [];
  const base = BASIS_POINTS_TOTAL / n;
  const rem = BASIS_POINTS_TOTAL % n;
  const out = [];
  for (let i = 0n; i < n; i += 1n) {
    out.push((i === n - 1n ? base + rem : base).toString());
  }
  return out;
};

export const sumBasisPoints = (bpsList) => {
  let total = 0n;
  for (const bps of bpsList) {
    total += toBpsInt(bps);
  }
  return total;
};

export const formatBpsPercent = (bps) => {
  const n = toBpsInt(bps);
  const whole = n / 100n;
  const frac = n % 100n;
  if (frac === 0n) return `${whole.toString()}%`;
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}%`;
};

export { WEI_PER_GEN };
