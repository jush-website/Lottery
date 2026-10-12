// 刮刮樂公式，D = A + B + C
// 款式一 'rate'：號碼 = D × (中獎率 + step × N)，例：137 × (0.3 + 0.033 × 3) = 54.663
// 款式二 'base'：號碼 = D × (1 + 中獎率 × N)，例：71 × (1 + 0.3 × 1) = 92.3
// 'auto'：D < 100 用款式二，否則用款式一
export const resolveVariant = (variant, d) => (variant === 'auto' ? (d < 100 ? 'base' : 'rate') : variant);

export const computeScratchNumbers = ({ a, b, c, winRate, step = 0.033, count = 30, variant = 'auto', maxNumber = 0 }) => {
  const d = a + b + c;
  const used = resolveVariant(variant, d);

  const rows = [];
  for (let k = 1; k <= count; k++) {
    const multiplier = used === 'base' ? 1 + winRate * k : winRate + step * k;
    const value = d * multiplier;
    const low = Math.floor(value);
    // 有設定號碼上限時，超出範圍的就不列入
    if (maxNumber > 0 && low > maxNumber) break;
    rows.push({ k, multiplier, value, low, high: Math.ceil(value) });
  }
  return { d, variant: used, rows };
};

// 彩券編號（例：014129-092）取前 6 碼，兩碼一組拆成 A、B、C；不足 6 碼回傳 null
export const parseSerial = (serial) => {
  const digits = String(serial).replace(/\D/g, '');
  if (digits.length < 6) return null;
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
};
