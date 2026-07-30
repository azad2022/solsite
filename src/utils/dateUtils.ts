// Accurate Jalali (Shamsi) & Gregorian (Miladi) Date Converter and Formatter Utilities

export function toPersianDigits(str: string | number): string {
  if (str === null || str === undefined) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

export function toEnglishDigits(str: string | number): string {
  if (str === null || str === undefined) return '';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return String(str)
    .replace(/[۰-۹]/g, (w) => String(persianDigits.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));
}

const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const GREGORIAN_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Converts Gregorian date (year, month 1-12, day 1-31) to Jalali (year, month 1-12, day 1-31)
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

/**
 * Converts Jalali date (year, month 1-12, day 1-31) to Gregorian (year, month 1-12, day 1-31)
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }
  return [gy, gm, gd];
}

export interface AccurateDatePair {
  jalali: string;           // e.g. "۱۴۰۴/۰۵/۰۵"
  gregorian: string;        // e.g. "2025/07/27" or "2025-07-27"
  jalaliPretty: string;     // e.g. "۵ مرداد ۱۴۰۴"
  gregorianPretty: string;  // e.g. "27 Jul 2025"
  combinedDisplay: string;  // e.g. "۱۴۰۴/۰۵/۰۵ (2025/07/27)"
}

/**
 * Format any input (ISO string, Shamsi string like '۱۴۰۴/۰۵/۰۵', or Date object)
 * into a complete, accurate pair of Jalali & Gregorian dates.
 */
export function formatAccurateDates(input?: string | Date): AccurateDatePair {
  let gy = 2026;
  let gm = 7;
  let gd = 29;
  let jy = 1405;
  let jm = 5;
  let jd = 7;

  if (!input) {
    const now = new Date();
    gy = now.getFullYear();
    gm = now.getMonth() + 1;
    gd = now.getDate();
    [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  } else if (input instanceof Date) {
    gy = input.getFullYear();
    gm = input.getMonth() + 1;
    gd = input.getDate();
    [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  } else {
    const cleanInput = toEnglishDigits(String(input)).trim();

    // Case 1: Shamsi pattern e.g. "1404/05/05" or "1404-05-05"
    const shamsiMatch = cleanInput.match(/^(13\d\d|14\d\d)[/-](\d{1,2})[/-](\d{1,2})$/);
    if (shamsiMatch) {
      jy = parseInt(shamsiMatch[1], 10);
      jm = Math.min(12, Math.max(1, parseInt(shamsiMatch[2], 10)));
      jd = Math.min(31, Math.max(1, parseInt(shamsiMatch[3], 10)));
      [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
    } else {
      // Case 2: Gregorian pattern e.g. "2025-07-27" or ISO string
      const parsedDate = new Date(cleanInput);
      if (!isNaN(parsedDate.getTime())) {
        gy = parsedDate.getFullYear();
        gm = parsedDate.getMonth() + 1;
        gd = parsedDate.getDate();
        [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
      } else {
        // Fallback to now
        const now = new Date();
        gy = now.getFullYear();
        gm = now.getMonth() + 1;
        gd = now.getDate();
        [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
      }
    }
  }

  const jyStr = String(jy);
  const jmStr = String(jm).padStart(2, '0');
  const jdStr = String(jd).padStart(2, '0');

  const gyStr = String(gy);
  const gmStr = String(gm).padStart(2, '0');
  const gdStr = String(gd).padStart(2, '0');

  const jalali = toPersianDigits(`${jyStr}/${jmStr}/${jdStr}`);
  const gregorian = `${gyStr}/${gmStr}/${gdStr}`;
  const jalaliPretty = `${toPersianDigits(jd)} ${PERSIAN_MONTH_NAMES[jm - 1] || ''} ${toPersianDigits(jy)}`;
  const gregorianPretty = `${gdStr} ${GREGORIAN_MONTH_NAMES[gm - 1] || ''} ${gyStr}`;
  const combinedDisplay = `${jalali} (${gregorian})`;

  return {
    jalali,
    gregorian,
    jalaliPretty,
    gregorianPretty,
    combinedDisplay
  };
}

/**
 * Utility to convert an edited Shamsi string (e.g. 1404/05/05) to its exact Gregorian string (2025/07/27)
 */
export function convertShamsiToGregorian(shamsiStr: string): string {
  const pair = formatAccurateDates(shamsiStr);
  return pair.gregorian;
}

/**
 * Utility to convert an edited Gregorian string (e.g. 2025-07-27) to its exact Shamsi string (۱۴۰۴/۰۵/۰۵)
 */
export function convertGregorianToShamsi(gregorianStr: string): string {
  const pair = formatAccurateDates(gregorianStr);
  return pair.jalali;
}
