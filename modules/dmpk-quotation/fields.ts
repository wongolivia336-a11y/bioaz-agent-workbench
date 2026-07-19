export type DmpkStage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
export type DmpkGroupId = "assay" | "animal" | "analysis" | "delivery";

export type DmpkField = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  group: DmpkGroupId;
};

export type DmpkDraftTab = {
  fieldId: string;
  label: string;
  value: string;
};

export const dmpkGroups: Array<{ id: DmpkGroupId; title: string }> = [
  { id: "assay", title: "检测类型" },
  { id: "animal", title: "动物实验" },
  { id: "analysis", title: "生物分析" },
  { id: "delivery", title: "报告与报价" },
];

export const initialDmpkFields: DmpkField[] = [
  { id: "assayType", label: "检测类型", value: "", required: true, group: "assay" },
  { id: "molecule", label: "分子类型", value: "", required: true, group: "assay" },
  { id: "species", label: "动物种属", value: "", required: true, group: "animal" },
  { id: "animalsPerGroup", label: "每组动物数", value: "", required: true, group: "animal" },
  { id: "groupCount", label: "组数", value: "", required: true, group: "animal" },
  { id: "cycle", label: "试验周期", value: "", required: true, group: "animal" },
  { id: "compoundType", label: "化合物类别", value: "", required: true, group: "analysis" },
  { id: "method", label: "分析方法", value: "", required: true, group: "analysis" },
  { id: "sampleType", label: "样品类型", value: "", required: true, group: "analysis" },
  { id: "bloodPoints", label: "采血点数", value: "", required: true, group: "analysis" },
  { id: "analyteCount", label: "待测物数量", value: "", required: true, group: "analysis" },
  { id: "format", label: "报告格式", value: "", required: true, group: "delivery" },
  { id: "language", label: "报告语言", value: "", required: true, group: "delivery" },
  { id: "region", label: "报价区域", value: "", required: true, group: "delivery" },
];

export const dmpkFieldOptions: Record<string, string[]> = {
  assayType: ["PK", "BA Only", "TOX"],
  molecule: ["小分子", "多肽", "抗体", "寡核苷酸"],
  species: ["SD 大鼠", "小鼠", "Beagle 犬", "食蟹猴"],
  animalsPerGroup: ["3", "6", "10", "自定义"],
  groupCount: ["3", "4", "6", "自定义"],
  cycle: ["1 周", "2 周", "4 周", "自定义"],
  compoundType: ["普通小分子", "寡核苷酸", "多肽", "抗体"],
  method: ["LC-MS/MS", "ELISA", "qPCR", "LBA"],
  sampleType: ["血浆", "血清", "组织匀浆", "尿液"],
  bloodPoints: ["3", "6", "9", "自定义"],
  analyteCount: ["1", "2", "3", "自定义"],
  format: ["Word + Excel", "Word", "Excel"],
  language: ["中文", "英文", "中英双语"],
  region: ["国内", "欧美", "亚太"],
};

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
  if (/dmpk|pk/i.test(text)) patch.assayType = "PK";
  if (/小分子/.test(text)) patch.molecule = "小分子";
  if (/sd\s*大鼠|大鼠/i.test(text)) patch.species = "SD 大鼠";
  const animalMatch = text.match(/每组\s*(\d+)\s*只/);
  if (animalMatch) patch.animalsPerGroup = animalMatch[1];
  const groupMatch = text.match(/(?:共|，|,|\s)(\d+)\s*组/);
  if (groupMatch) patch.groupCount = groupMatch[1];
  const cycleMatch = text.match(/(?:周期|试验周期)\s*(\d+)\s*周/);
  if (cycleMatch) patch.cycle = `${cycleMatch[1]} 周`;
  const bloodMatch = text.match(/(\d+)\s*个?(?:非加班)?采血点/);
  if (bloodMatch) patch.bloodPoints = bloodMatch[1];
  return patch;
}
