/**
 * 拼接条件类名。
 *
 * 项目里此前一律用模板字符串，`false` 分支会留下尾随空格，
 * 于是到处跟着 `.trim()`，而中间的多余空格并不会被清掉。
 *
 * 不引 clsx / tailwind-merge：没有 Tailwind 就没有原子类冲突合并的需求，
 * 这里只需要过滤假值。
 */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
