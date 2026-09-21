import type { ParamDraft, ParamField, ParamGroup } from "../../components/params";

export type DmpkStage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
export type DmpkGroupId = "assay" | "animal" | "analysis" | "delivery";

/* 字段形状搬到了 components/params：肿瘤报价用的是同一副骨架、同一套类名。
   这里只把 group 收窄成 DMPK 自己的四组，别的一个字没改——十四项仍然全是
   选项按钮（kind 缺省就是 options）。 */
export type DmpkField = ParamField & { group: DmpkGroupId };
export type DmpkDraftTab = ParamDraft;

export const dmpkGroups: Array<ParamGroup & { id: DmpkGroupId }> = [
  { id: "assay", title: "检测类型" },
  { id: "animal", title: "动物实验" },
  { id: "analysis", title: "生物分析" },
  { id: "delivery", title: "报告与报价" },
];

export const dmpkFieldOptions: Record<string, string[]> = {
  assayType: ["PK", "BA Only", "TOX"],
  molecule: ["小分子", "多肽", "抗体", "寡核苷酸"],
  species: ["SD 大鼠", "小鼠", "Beagle 犬", "食蟹猴"],
  animalsPerGroup: ["3", "6", "10"],
  // 2 是当前值、3 是批注建议值，两个都要能点到
  groupCount: ["2", "3", "4", "6"],
  cycle: ["1 周", "2 周", "4 周"],
  compoundType: ["普通小分子", "寡核苷酸", "多肽", "抗体"],
  method: ["LC-MS/MS", "ELISA", "qPCR", "LBA"],
  sampleType: ["血浆", "血清", "组织匀浆", "尿液"],
  /* 10 是审批人批注里给的建议值。选项表里没有它的话，照着批注改这条路
     只能走「自定义」——演示时那一下会很别扭，而且它本来就是个常见取值。 */
  bloodPoints: ["3", "6", "8", "10"],
  analyteCount: ["1", "2", "3"],
  format: ["Word + Excel", "Word", "Excel"],
  language: ["中文", "英文", "中英双语"],
  region: ["国内", "欧美", "亚太"],
};

/* 「自定义」不再写进选项表，改成字段上的 allowCustom 由行渲染器统一补在末尾。
   写进表里的那份迟早跟渲染器分叉。开的仍然是原来那五项——数量、组数、周期、
   采血点、待测物数，它们天然是开放取值；封闭词表（报告格式、分析方法）不开。 */
const OPEN_VALUE_FIELDS = new Set(["animalsPerGroup", "groupCount", "cycle", "bloodPoints", "analyteCount"]);

const field = (id: string, label: string, group: DmpkGroupId): DmpkField => ({
  id,
  label,
  value: "",
  required: true,
  group,
  options: dmpkFieldOptions[id] ?? [],
  allowCustom: OPEN_VALUE_FIELDS.has(id),
});

export const initialDmpkFields: DmpkField[] = [
  field("assayType", "检测类型", "assay"),
  field("molecule", "分子类型", "assay"),
  field("species", "动物种属", "animal"),
  field("animalsPerGroup", "每组动物数", "animal"),
  field("groupCount", "组数", "animal"),
  field("cycle", "试验周期", "animal"),
  field("compoundType", "化合物类别", "analysis"),
  field("method", "分析方法", "analysis"),
  field("sampleType", "样品类型", "analysis"),
  field("bloodPoints", "采血点数", "analysis"),
  field("analyteCount", "待测物数量", "analysis"),
  field("format", "报告格式", "delivery"),
  field("language", "报告语言", "delivery"),
  field("region", "报价区域", "delivery"),
];

/**
 * 「不适用」（P0 工程方案完成清单里的一态）：这一单用不上的项不算缺。
 *
 * BA Only 是客户送样本来测，没有动物、没有分组、没有周期——原来十四项一律必填，
 * BA Only 的会话开口就追问「动物种属、每组动物数、组数、试验周期」，P0 明写
 * "字段缺失先判断是否适用"。所以按检测类型把这几项标成不适用：不必填、卡里不列、
 * 台账写「不适用」。人硬要填也可以（比如客户顺便说了种属），填了就照常显示。
 *
 * 每次字段变化都过一遍——它是"这一项此刻的处境"，跟着检测类型走，不是写死的配置。
 */
const NOT_APPLICABLE_BY_ASSAY: Record<string, { ids: string[]; hint: string }> = {
  "BA Only": { ids: ["species", "animalsPerGroup", "groupCount", "cycle"], hint: "BA Only 由客户送样，不涉及动物与周期" },
};

export function applyDmpkApplicability(fields: DmpkField[]): DmpkField[] {
  const assay = fields.find((field) => field.id === "assayType")?.value ?? "";
  const rule = NOT_APPLICABLE_BY_ASSAY[assay];
  return fields.map((field) => {
    const off = Boolean(rule?.ids.includes(field.id));
    if (off === Boolean(field.notApplicable) && field.required === !off) return field;
    /* DMPK 十四项本来没有 hint，这里的 hint 只用来说明「为什么不适用」，退回时清掉即可 */
    return { ...field, required: !off, notApplicable: off || undefined, hint: off ? rule!.hint : undefined };
  });
}

export const dmpkGroupDescriptions: Record<DmpkGroupId, string> = {
  assay: "确认 DMPK 下的检测业务线与分子类型。",
  animal: "动物数量、组数和周期会直接影响报价规则。",
  analysis: "请补齐分析方法、样品和待测物参数。",
  delivery: "确认交付格式、语言、区域和管理费规则。",
};

export function getDmpkGroupTitle(id: DmpkGroupId) {
  return dmpkGroups.find((group) => group.id === id)?.title ?? "";
}

export function parseDmpkRequest(text: string): Record<string, string> {
  const patch: Record<string, string> = {};
  if (/ba\s*only|ba-only|体外.*生物分析/i.test(text)) patch.assayType = "BA Only";
  else if (/tox|毒理/i.test(text)) patch.assayType = "TOX";
  else if (/dmpk|pk/i.test(text)) patch.assayType = "PK";
  if (/小分子/.test(text)) patch.molecule = "小分子";
  /* 种属按选项表逐个认，别只认大鼠——「Balb/c nude 小鼠」这种最常见的写法
     以前会整条掉地上，识别结果里种属仍是空的，看着像系统没读懂用户。 */
  if (/sd\s*大鼠|大鼠/i.test(text)) patch.species = "SD 大鼠";
  else if (/小鼠|balb\s*\/?\s*c|nude|c57/i.test(text)) patch.species = "小鼠";
  else if (/beagle|比格|犬|狗/i.test(text)) patch.species = "Beagle 犬";
  else if (/食蟹猴|猕猴|猴/i.test(text)) patch.species = "食蟹猴";
  const animalMatch = text.match(/每组\s*(\d+)\s*只/);
  if (animalMatch) patch.animalsPerGroup = animalMatch[1];
  const groupMatch = text.match(/(?:共|，|,|\s)(\d+)\s*组/);
  if (groupMatch) patch.groupCount = groupMatch[1];
  const cycleMatch = text.match(/(?:周期|试验周期)\s*(\d+)\s*周/);
  if (cycleMatch) patch.cycle = `${cycleMatch[1]} 周`;

  /* 采血点：**两种语序都要认**。
     「8 个采血点」和「采血点 8 个」在中文里一样自然，而原来只认前者，
     写成后者整条掉地上——识别结果里少一项，人得把刚说过的话再说一遍。
     一个数字识别不出来事小，「它没读懂我」这个印象事大。

     「时间点」「采样点」和「采血点」在客户嘴里是一个意思，
     输入框自己的例句用的还是「时间点」。 */
  const points = "(?:采血点|采样点|时间点)";
  const bloodMatch =
    text.match(new RegExp(`(\\d+)\\s*个?(?:非加班)?${points}`)) ??
    text.match(new RegExp(`${points}\\s*(\\d+)\\s*个?`));
  if (bloodMatch) patch.bloodPoints = bloodMatch[1];

  /* 待测物数：P0 八维里的⑥检测项目按化合物计价（30 的规则也按化合物执行），
     人会说「2 个待测物」「化合物 2 个」「分析物 2 项」，三种叫法一个意思。 */
  const analytes = "(?:待测物|分析物|化合物)";
  const analyteMatch =
    text.match(new RegExp(`(\\d+)\\s*[个项]?${analytes}`)) ??
    text.match(new RegExp(`${analytes}\\s*(\\d+)\\s*[个项]?`));
  if (analyteMatch) patch.analyteCount = analyteMatch[1];

  /* 下面四项以前一条规则都没有，可选项表里明明列着。
     用户一句话里把样品、方法、格式都说了，识别结果却只回四项，
     剩下的还要一项项点——演示时这一下最伤，因为它看起来像没在听。
     认的都是选项表里的原词，认不出就留空走补全，不猜。 */
  if (/lc\s*-?\s*ms\s*\/?\s*ms|lcms/i.test(text)) patch.method = "LC-MS/MS";
  else if (/elisa/i.test(text)) patch.method = "ELISA";
  else if (/qpcr/i.test(text)) patch.method = "qPCR";
  else if (/lba|配体结合/i.test(text)) patch.method = "LBA";

  if (/血浆/.test(text)) patch.sampleType = "血浆";
  else if (/血清/.test(text)) patch.sampleType = "血清";
  else if (/组织匀浆|匀浆/.test(text)) patch.sampleType = "组织匀浆";
  else if (/尿液|尿样/.test(text)) patch.sampleType = "尿液";

  const wantsWord = /word|文档报告/i.test(text);
  const wantsExcel = /excel|表格|明细/i.test(text);
  if (wantsWord && wantsExcel) patch.format = "Word + Excel";
  else if (wantsWord) patch.format = "Word";
  else if (wantsExcel) patch.format = "Excel";

  if (/中英双语|中英文/.test(text)) patch.language = "中英双语";
  else if (/英文报告|英文版|english/i.test(text)) patch.language = "英文";
  else if (/中文报告|中文版/.test(text)) patch.language = "中文";

  /* 报价区域一直没有规则——语言、格式都认，偏偏它不认。后果是「报价区域国内」
     这句掉进兜底文案，而「核对已有信息」那条路对它永远找不回。
     认的是选项表里的原词；「按国内价」「国内报价」「欧美客户」这几种说法都要接住。 */
  if (/欧美|美国|欧洲|海外/.test(text)) patch.region = "欧美";
  else if (/亚太|日本|韩国|东南亚/.test(text)) patch.region = "亚太";
  else if (/国内(?!外)|境内|人民币|不用美元/.test(text)) patch.region = "国内";

  return patch;
}
