/**
 * 报价参数的通用形状。
 *
 * 这一层是从 DMPK 报价里抽出来的，不是新发明的东西：
 * `modules/dmpk-quotation/fields.ts` 原来的 `DmpkField` 就是下面这个 shape
 * 去掉 `kind` 之后的样子。抽出来的理由只有一个——肿瘤报价要复用同一套卡片、
 * 同一套 chips、同一套台账，而参数卡的样式散在四个全局样式表里
 * （`.parameterTaskCard` / `.decisionRow` / `.optionGrid` …），
 * 复制一份改名字等于复制 123 条 CSS 规则，并且漏掉 responsive.css 里
 * 写死的 `:is(.dmpk-quotationModuleShell, …)` 白名单——窄屏会静默塌掉。
 * 所以是**共用同一套类名 + 数据驱动**，不是复制。
 *
 * 取值一律是 string
 * ----------------------------------------------------------------------
 * 多选序列化成「A、B」，重复行序列化成「Vehicle:0 mg/kg;DrugA:10 mg/kg」。
 * 不引入联合类型，是因为下游全都按 string 读：右栏台账、composer chips、
 * 报价前预览表、会话快照的 facts。换成结构化取值，这四处要一起改，
 * 而它们真正需要的只是「这一项现在写着什么」。
 */

export type ParamFieldKind = "options" | "select" | "text" | "multi" | "repeat";

export type ParamGroup = { id: string; title: string };

/** 重复行里的一列。给了 options 就渲染下拉，否则是文本框。 */
export type RepeatColumn = {
  id: string;
  label: string;
  placeholder?: string;
  options?: string[];
};

export type ParamField = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  group: string;
  /** 缺省是 options——DMPK 十四项全是这一种，不写就保持原样。 */
  kind?: ParamFieldKind;
  options?: string[];
  /**
   * 选项跟着 `dependsOn[0]` 的取值变。
   * 键是那一项的取值，值是本项此时可选的列表；没命中就回落到 `options`。
   */
  optionsBy?: Record<string, string[]>;
  /**
   * 这些项没填之前，本项不能填。
   * 锁住时给的是**中性占位**（「请先选择模型」），不是红字报错——
   * 一张还没动过的空表单上先铺一片红，是在为尚未发生的错误问责。
   */
  dependsOn?: string[];
  placeholder?: string;
  /** 行内说明。只在需要交代填法时给，不要拿它复述标签。 */
  hint?: string;
  /** kind === "repeat" 时的列定义 */
  columns?: RepeatColumn[];
  /**
   * 给这一项加一个「自定义」出口。缺省不加——封闭词表（报告格式、分析方法）
   * 多一个自定义入口，等于邀请人写出系统认不了的取值。
   * multi 上则表示允许自己补一条。
   */
  allowCustom?: boolean;
};

export type ParamDraft = { fieldId: string; label: string; value: string };

export const MULTI_SEPARATOR = "、";
export const REPEAT_ROW_SEPARATOR = ";";
export const REPEAT_CELL_SEPARATOR = ":";

export function splitMulti(value: string): string[] {
  return value ? value.split(MULTI_SEPARATOR).filter(Boolean) : [];
}

export function joinMulti(values: string[]): string {
  return values.join(MULTI_SEPARATOR);
}

export function splitRepeat(value: string): string[][] {
  return value
    ? value.split(REPEAT_ROW_SEPARATOR).filter(Boolean).map((row) => row.split(REPEAT_CELL_SEPARATOR))
    : [];
}

export function joinRepeat(rows: string[][]): string {
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      /* 末尾的空格子去掉，中间的留着——中间那些空位是**位置信息**：
         「Vehicle::0 mg/kg」说的是受试物没填、剂量填了 0。
         而只填了第一格却序列化成「Vehicle::」，chip 上就是一串没意义的冒号。 */
      const trimmed = cells.map((cell) => cell.trim());
      while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
      return trimmed.join(REPEAT_CELL_SEPARATOR);
    })
    .join(REPEAT_ROW_SEPARATOR);
}

/**
 * 当前生效的取值：待发草稿盖过已落库的值。
 * 同一项被改过，卡片和依赖判断要看的是那个改动，不是旧值。
 */
export function effectiveValues(fields: ParamField[], drafts: ParamDraft[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) values[field.id] = field.value;
  for (const draft of drafts) values[draft.fieldId] = draft.value;
  return values;
}

/** 还没满足的依赖项。空数组＝这一项现在可以填。 */
export function unmetDependencies(field: ParamField, fields: ParamField[], values: Record<string, string>): ParamField[] {
  if (!field.dependsOn?.length) return [];
  return field.dependsOn
    .map((id) => fields.find((item) => item.id === id))
    .filter((item): item is ParamField => Boolean(item) && !values[item!.id]);
}

/** 锁住时的占位文案。「请先选择模型和动物品系」——照着缺的那几项拼。 */
export function lockedPlaceholder(unmet: ParamField[]): string {
  return `请先选择${unmet.map((field) => field.label).join("和")}`;
}

/** 这一项此刻可选的列表。optionsBy 命中就用它，否则回落到 options。 */
export function resolveOptions(field: ParamField, values: Record<string, string>): string[] {
  if (field.optionsBy && field.dependsOn?.length) {
    const key = values[field.dependsOn[0]];
    if (key && field.optionsBy[key]) return field.optionsBy[key];
  }
  return field.options ?? [];
}
