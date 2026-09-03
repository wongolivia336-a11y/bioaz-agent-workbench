import type { ParamDraft, ParamField, ParamGroup } from "../../components/params";

/**
 * 肿瘤报价的参数表。
 *
 * 词表从哪来
 * ----------------------------------------------------------------------
 * **照抄工程师 beta3 的**：模型的 8 个中英双语选项、检测指标的 8 项、
 * 临床监测的 3 项、分组及给药剂量的填写说明、报告语言。这些在截图里逐字可读。
 *
 * **原型这边补的**：动物品系与细胞系随模型联动的对应关系、接种方式、
 * 给药途径与频率、实验周期与分组标准的档位、以及「类型」的三个取值。
 * 工程师那一版里这几项要么是自由文本、要么截图没露出来。
 * 上线前这一段要拿业务的正式词表覆盖——**这是配置，不是设计**。
 *
 * 顺带修了一处数据自相矛盾：beta3 的演示值是「CDX/免疫缺陷动物模型 +
 * CB-17 SCID + MC38」，而 MC38 是 C57BL/6 背景的鼠源系，接不到免疫缺陷鼠上。
 * 这里把细胞系也挂进联动，选了免疫缺陷模型就只列人源系。
 *
 * 必填 8 项
 * ----------------------------------------------------------------------
 * 类型、模型、动物品系、接种方式、实验周期、每组动物数、分组及给药剂量、检测指标。
 * 这个数是从 beta3 截图反推的（进度条写「必填项 0/8」，填到一半是 6/8），
 * 跟工程师核一遍即可，改一个 `required` 的事。
 */

export type TumorStage = "idle" | "thinking" | "collecting" | "ready" | "generating" | "generated";
export type TumorGroupId = "model" | "design" | "dosing" | "readout";

export type TumorField = ParamField & { group: TumorGroupId };
export type TumorDraftTab = ParamDraft;

export const tumorGroups: Array<ParamGroup & { id: TumorGroupId }> = [
  { id: "model", title: "模型与动物" },
  { id: "design", title: "实验设计" },
  { id: "dosing", title: "给药方案" },
  { id: "readout", title: "检测与交付" },
];

/* 模型：照抄 beta3，一个字没动。八项里最长的一条 437px，
   平铺进选项按钮要折 4 行、占 127px——所以这一项走下拉。 */
export const tumorModelOptions = [
  "CDX/免疫缺陷动物模型",
  "Syngeneic Models/鼠源模型",
  "PDX model/常规PDX模型",
  "Humanized Models/人源化模型",
  "CDX/syngeneic drug resistance model CDX/鼠源耐药模型",
  "Drug resistance PDX model/PDX耐药模型（非PBMC模型）",
  "hPBMC humanized PDX model/hPBMC+常规PDX模型",
  "hPBMC humanized drug resistance PDX model/hPBMC+ PDX耐药模型",
];

/* 品系随模型走。免疫缺陷模型接人源瘤，鼠源模型接同源背景，
   人源化模型要重度免疫缺陷鼠——选错了后面整条实验都不成立，
   所以这里不是「筛一下方便你找」，是把不可能的组合直接拿掉。 */
const strainsByModel: Record<string, string[]> = {
  "CDX/免疫缺陷动物模型": ["BALB/c nude", "CB-17 SCID", "NOD-SCID", "NCG", "NSG"],
  "Syngeneic Models/鼠源模型": ["C57BL/6", "BALB/c", "FVB"],
  "PDX model/常规PDX模型": ["NOD-SCID", "NCG", "NSG", "B-NDG"],
  "Humanized Models/人源化模型": ["NCG", "NSG", "B-NDG"],
  "CDX/syngeneic drug resistance model CDX/鼠源耐药模型": ["BALB/c nude", "C57BL/6", "BALB/c"],
  "Drug resistance PDX model/PDX耐药模型（非PBMC模型）": ["NOD-SCID", "NCG", "B-NDG"],
  "hPBMC humanized PDX model/hPBMC+常规PDX模型": ["NCG", "NSG", "B-NDG"],
  "hPBMC humanized drug resistance PDX model/hPBMC+ PDX耐药模型": ["NCG", "NSG", "B-NDG"],
};

const cellLinesByModel: Record<string, string[]> = {
  "CDX/免疫缺陷动物模型": ["A549", "HCT116", "MDA-MB-231", "NCI-H1975", "SK-OV-3", "HT-29"],
  "Syngeneic Models/鼠源模型": ["MC38", "CT26", "4T1", "B16-F10", "LLC", "EMT6"],
  "CDX/syngeneic drug resistance model CDX/鼠源耐药模型": ["A549/TAX", "HCT116/5-FU", "MC38-R", "CT26-R"],
};

/* PDX 与人源化模型用的是病人来源组织块，没有细胞系可选——
   给一个空列表不如明说，否则人会以为是没加载出来。 */
const PDX_CELL_LINE_NOTE = ["不适用（PDX 组织块）"];

export const tumorReadoutOptions = [
  "IVIS Imaging",
  "Fluorescence imaging",
  "Ex vivo Imaging",
  "X-ray Imaging",
  "Sample collection（血清/血浆采集）",
  "Tumor resection",
  "Castration",
  "2nd inoculation",
  "不需要检测",
];

export const initialTumorFields: TumorField[] = [
  {
    id: "quoteType",
    label: "类型",
    value: "",
    required: true,
    group: "model",
    options: ["体内药效评价", "体外活性评价", "药效 + PK 联合"],
  },
  {
    id: "model",
    label: "模型",
    value: "",
    required: true,
    group: "model",
    kind: "select",
    options: tumorModelOptions,
    placeholder: "选择模型",
  },
  {
    id: "strain",
    label: "动物品系",
    value: "",
    required: true,
    group: "model",
    kind: "select",
    dependsOn: ["model"],
    optionsBy: strainsByModel,
    options: [],
    placeholder: "选择动物品系",
  },
  {
    id: "cellLine",
    label: "细胞系",
    value: "",
    required: false,
    group: "model",
    kind: "select",
    dependsOn: ["model"],
    optionsBy: {
      ...cellLinesByModel,
      "PDX model/常规PDX模型": PDX_CELL_LINE_NOTE,
      "Humanized Models/人源化模型": PDX_CELL_LINE_NOTE,
      "Drug resistance PDX model/PDX耐药模型（非PBMC模型）": PDX_CELL_LINE_NOTE,
      "hPBMC humanized PDX model/hPBMC+常规PDX模型": PDX_CELL_LINE_NOTE,
      "hPBMC humanized drug resistance PDX model/hPBMC+ PDX耐药模型": PDX_CELL_LINE_NOTE,
    },
    options: [],
    placeholder: "选择细胞系",
  },
  {
    id: "inoculation",
    label: "接种方式",
    value: "",
    required: true,
    group: "model",
    dependsOn: ["model", "strain"],
    options: ["皮下接种", "原位接种", "静脉接种", "腹腔接种"],
  },
  { id: "sex", label: "性别", value: "", required: false, group: "model", options: ["雄性", "雌性", "雌雄各半"] },

  {
    id: "cycle",
    label: "实验周期",
    value: "",
    required: true,
    group: "design",
    options: ["2–4 周", "4–6 周", "6–8 周", "8 周以上"],
    allowCustom: true,
  },
  {
    id: "animalsPerGroup",
    label: "每组动物数",
    value: "",
    required: true,
    group: "design",
    options: ["6 只/组", "8 只/组", "10 只/组", "12 只/组"],
    allowCustom: true,
  },
  {
    id: "groupingCriteria",
    label: "分组标准",
    value: "",
    required: false,
    group: "design",
    options: ["80–120 mm³", "100–150 mm³", "150–200 mm³"],
    hint: "肿瘤体积达到该区间时随机分组。",
    allowCustom: true,
  },

  {
    id: "route",
    label: "给药途径",
    value: "",
    required: false,
    group: "dosing",
    options: ["口服（po）", "腹腔（ip）", "静脉（iv）", "皮下（sc）", "瘤内（it）"],
  },
  {
    id: "frequency",
    label: "给药频率",
    value: "",
    required: false,
    group: "dosing",
    options: ["qd（每日）", "bid（每日两次）", "q2d（隔日）", "qw（每周）", "biw（每周两次）"],
  },
  {
    id: "doseGroups",
    label: "分组及给药剂量",
    value: "",
    required: true,
    group: "dosing",
    kind: "repeat",
    /* 说明照抄 beta3。这句话是**必要的**：对照组剂量填 0 还是填别的，
       决定了报价里算不算这一组的给药操作费，人不问就会漏。 */
    hint: "每一行就是一个实验组；请明确填写对照组，对照组剂量可以为 0 或非零。",
    columns: [
      { id: "group", label: "组别", placeholder: "如 Vehicle / G1" },
      { id: "article", label: "受试物", placeholder: "如 DrugA" },
      { id: "dose", label: "剂量", placeholder: "如 10 mg/kg" },
    ],
  },

  {
    id: "readouts",
    label: "检测指标",
    value: "",
    required: true,
    group: "readout",
    kind: "multi",
    options: tumorReadoutOptions,
  },
  {
    id: "monitoring",
    label: "临床监测",
    value: "",
    required: false,
    group: "readout",
    kind: "multi",
    options: ["体重监测（每周两次）", "肿瘤体积（每三天一次）", "瘤重监测"],
    allowCustom: true,
    placeholder: "输入监测项，回车添加",
  },
  { id: "reportLanguage", label: "报告语言", value: "", required: false, group: "readout", options: ["中文", "英文", "双语"] },
];

export function getTumorGroupTitle(id: TumorGroupId) {
  return tumorGroups.find((group) => group.id === id)?.title ?? "";
}

/**
 * 从一句话里认出已知参数。
 *
 * 跟 DMPK 那份同一个立场：**认不出就留空走补全，不猜**。
 * 猜错一项比少认一项贵得多——少认了人补一下，猜错了他得先发现你猜了。
 */
export function parseTumorRequest(text: string): Record<string, string> {
  const patch: Record<string, string> = {};

  /* 模型按特征词逐个认。顺序有讲究：耐药、hPBMC 这些是在基础模型上叠的定语，
     必须先判，否则「hPBMC+常规PDX」会被前面的 PDX 规则先吃掉。 */
  if (/hpbmc.*耐药|耐药.*hpbmc/i.test(text)) patch.model = "hPBMC humanized drug resistance PDX model/hPBMC+ PDX耐药模型";
  else if (/hpbmc/i.test(text)) patch.model = "hPBMC humanized PDX model/hPBMC+常规PDX模型";
  else if (/pdx.*耐药|耐药.*pdx/i.test(text)) patch.model = "Drug resistance PDX model/PDX耐药模型（非PBMC模型）";
  else if (/(?:cdx|鼠源).*耐药|耐药.*(?:cdx|鼠源)/i.test(text)) patch.model = "CDX/syngeneic drug resistance model CDX/鼠源耐药模型";
  else if (/人源化|humanized/i.test(text)) patch.model = "Humanized Models/人源化模型";
  else if (/pdx/i.test(text)) patch.model = "PDX model/常规PDX模型";
  else if (/鼠源|syngeneic|同源/i.test(text)) patch.model = "Syngeneic Models/鼠源模型";
  else if (/cdx|免疫缺陷/i.test(text)) patch.model = "CDX/免疫缺陷动物模型";

  /* 品系只在跟模型对得上的时候才认。对不上就留空——
     模型和品系是联动的，塞一个模型下不存在的品系进去，
     人打开下拉会发现里面根本没有那一项，比留空更让人困惑。 */
  const strainCandidates: Array<[RegExp, string]> = [
    [/balb\s*\/?\s*c\s*nude|裸鼠/i, "BALB/c nude"],
    [/cb-?17|c\.?b-?17/i, "CB-17 SCID"],
    [/nod-?scid/i, "NOD-SCID"],
    [/\bncg\b/i, "NCG"],
    [/\bnsg\b/i, "NSG"],
    [/b-?ndg/i, "B-NDG"],
    [/c57\s*bl\s*\/?\s*6|c57/i, "C57BL/6"],
    [/balb\s*\/?\s*c/i, "BALB/c"],
  ];
  const strainHit = strainCandidates.find(([pattern]) => pattern.test(text))?.[1];
  if (strainHit && patch.model && strainsByModel[patch.model]?.includes(strainHit)) patch.strain = strainHit;

  const cellHit = ["MC38", "CT26", "4T1", "B16-F10", "LLC", "EMT6", "A549", "HCT116", "MDA-MB-231", "NCI-H1975", "SK-OV-3", "HT-29"]
    .find((line) => new RegExp(line.replace(/[-/]/g, "[-/]?"), "i").test(text));
  if (cellHit && patch.model && cellLinesByModel[patch.model]?.includes(cellHit)) patch.cellLine = cellHit;

  if (/皮下/.test(text)) patch.inoculation = "皮下接种";
  else if (/原位/.test(text)) patch.inoculation = "原位接种";
  else if (/静脉接种|尾静脉/.test(text)) patch.inoculation = "静脉接种";
  else if (/腹腔接种/.test(text)) patch.inoculation = "腹腔接种";

  if (/雌雄各半|雌雄/.test(text)) patch.sex = "雌雄各半";
  else if (/雄性|公鼠/.test(text)) patch.sex = "雄性";
  else if (/雌性|母鼠/.test(text)) patch.sex = "雌性";

  /* 周期：区间和单值都要认，而且**单值不能要求带前缀**。
     客户就是会写「…，4 周，口服 qd」——只认「周期 4 周」的话这一条整个掉地上，
     人得把刚说过的话再说一遍。DMPK 那边在采血点上栽过一模一样的坑。
     唯一要挡的是「每周两次 / 2 周一次」这种频率说法，它说的不是总时长。 */
  const rangeMatch = text.match(/(\d+)\s*[-–~至]\s*(\d+)\s*周/);
  const weekMatch = text.match(/(?:周期|实验周期|为期)\s*(\d+)\s*周/) ?? text.match(/(\d+)\s*周(?!\s*(?:一次|两次|[1-9]\s*次|内))/);
  if (rangeMatch) patch.cycle = `${rangeMatch[1]}–${rangeMatch[2]} 周`;
  else if (weekMatch) {
    const weeks = Number(weekMatch[1]);
    patch.cycle = weeks <= 4 ? "2–4 周" : weeks <= 6 ? "4–6 周" : weeks <= 8 ? "6–8 周" : "8 周以上";
  }

  /* 「每组 10 只」和「10 只/组」在客户嘴里是一个意思。
     只认前者的话，写成后者整条掉地上——DMPK 那边在采血点上栽过同一个坑。 */
  const perGroup = text.match(/每组\s*(\d+)\s*只/) ?? text.match(/(\d+)\s*只\s*\/?\s*组/);
  if (perGroup) patch.animalsPerGroup = `${perGroup[1]} 只/组`;

  const volumeMatch = text.match(/(\d+)\s*[-–~至]\s*(\d+)\s*mm3|(\d+)\s*[-–~至]\s*(\d+)\s*mm³/i);
  if (volumeMatch) {
    const low = volumeMatch[1] ?? volumeMatch[3];
    const high = volumeMatch[2] ?? volumeMatch[4];
    patch.groupingCriteria = `${low}–${high} mm³`;
  }

  if (/口服|\bpo\b|灌胃|\big\b/i.test(text)) patch.route = "口服（po）";
  else if (/腹腔注射|\bip\b/i.test(text)) patch.route = "腹腔（ip）";
  else if (/静脉注射|\biv\b/i.test(text)) patch.route = "静脉（iv）";
  else if (/皮下注射|\bsc\b/i.test(text)) patch.route = "皮下（sc）";
  else if (/瘤内|\bit\b/i.test(text)) patch.route = "瘤内（it）";

  if (/\bbid\b|每日两次/i.test(text)) patch.frequency = "bid（每日两次）";
  else if (/\bbiw\b|每周两次/i.test(text)) patch.frequency = "biw（每周两次）";
  else if (/\bq2d\b|隔日/i.test(text)) patch.frequency = "q2d（隔日）";
  else if (/\bqw\b|每周(?!两次)/i.test(text)) patch.frequency = "qw（每周）";
  else if (/\bqd\b|每日(?!两次)|每天/i.test(text)) patch.frequency = "qd（每日）";

  const readouts = tumorReadoutOptions.filter((option) => {
    if (option === "不需要检测") return /不需要检测|无需检测/.test(text);
    if (option === "IVIS Imaging") return /ivis/i.test(text);
    if (option === "Fluorescence imaging") return /荧光成像|fluorescence/i.test(text);
    if (option === "Ex vivo Imaging") return /离体成像|ex\s*vivo/i.test(text);
    if (option === "X-ray Imaging") return /x\s*-?\s*ray|x\s*光/i.test(text);
    if (option === "Sample collection（血清/血浆采集）") return /采血|血清|血浆|样本采集|样品采集/.test(text);
    if (option === "Tumor resection") return /肿瘤切除|瘤体切除|resection/i.test(text);
    if (option === "Castration") return /去势|castration/i.test(text);
    if (option === "2nd inoculation") return /二次接种|再接种/.test(text);
    return false;
  });
  if (readouts.length) patch.readouts = readouts.join("、");

  if (/双语|中英/.test(text)) patch.reportLanguage = "双语";
  else if (/英文报告|英文版|english/i.test(text)) patch.reportLanguage = "英文";
  else if (/中文报告|中文版/.test(text)) patch.reportLanguage = "中文";

  if (/体外|in\s*vitro/i.test(text)) patch.quoteType = "体外活性评价";
  else if (/药效.*pk|pk.*药效|联合/i.test(text)) patch.quoteType = "药效 + PK 联合";
  else if (/药效|体内|in\s*vivo/i.test(text)) patch.quoteType = "体内药效评价";

  return patch;
}
