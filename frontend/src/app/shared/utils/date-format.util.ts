import { DATE_FORMAT_ENUM } from "../enum/date-time.enum";

export function formatDateUtils(
  input: Date | string | number | null | undefined,
  dateFormat: DATE_FORMAT_ENUM
): string {
  if (!input) return '';

  const date = new Date(input);

  // check invalid date
  if (isNaN(date.getTime())) return '';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  switch (dateFormat) {
    case DATE_FORMAT_ENUM.DD_MM_YYYY:
      return `${dd}/${mm}/${yyyy}`;

    case DATE_FORMAT_ENUM.YYYY_MM_DD:
      return `${yyyy}/${mm}/${dd}`;

    case DATE_FORMAT_ENUM.DD_MM_YYYY_DASH:
      return `${dd}-${mm}-${yyyy}`;

    case DATE_FORMAT_ENUM.YYYY_MM_DD_DASH:
      return `${yyyy}-${mm}-${dd}`;

    case DATE_FORMAT_ENUM.DD_MM_YYYY_HH_MM_SS:
      return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;

    case DATE_FORMAT_ENUM.DDMMYYYY:
      return `${dd}${mm}${yyyy}`;

    default:
      return '';
  }
}