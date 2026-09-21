/**
 * 专家卡右下角那张底纹：每个角色一个意象，线稿、极淡，像纸上的水印。
 *
 * 它不是图标（左上角那个才是），是**这张卡在讲什么活**的一点点氛围：
 *   DMPK 报价   一支试管 + 一张价签
 *   肿瘤报告    一页报告 + 一根趋势线
 *   肿瘤报价    一簇细胞（肿瘤模型）+ 一张价签
 *   QA 审核     一个盾 + 一个勾
 *
 * 颜色由 CSS 管（stroke: currentColor），默认是 #e3e6ec 这种几乎看不见的灰，
 * hover 才深一档。不用品牌紫——这一屏紫已经够多了。
 */
export type RoleMotifKind = "dmpk-quotation" | "tumor-report" | "tumor-quotation" | "qa-review";

const motifs: Record<RoleMotifKind, JSX.Element> = {
  "dmpk-quotation": (
    <>
      {/* 试管 */}
      <path d="M22 6 h14 M25 6 v20 a4 4 0 0 0 8 0 v-20" />
      <path d="M25 18 h8" />
      {/* 价签 */}
      <path d="M44 30 l14 -14 h12 v12 l-14 14 z" />
      <circle cx="64" cy="22" r="2" />
    </>
  ),
  "tumor-report": (
    <>
      {/* 报告页 */}
      <path d="M18 8 h26 l10 10 v40 a3 3 0 0 1 -3 3 h-33 a3 3 0 0 1 -3 -3 v-47 a3 3 0 0 1 3 -3z" />
      <path d="M44 8 v10 h10" />
      {/* 趋势线 */}
      <path d="M24 48 l8 -8 l7 5 l12 -14" />
      <path d="M24 54 h20" />
    </>
  ),
  "tumor-quotation": (
    <>
      {/* 细胞簇 */}
      <circle cx="30" cy="30" r="12" />
      <circle cx="44" cy="22" r="7" />
      <circle cx="42" cy="40" r="5" />
      <circle cx="30" cy="30" r="3" />
      {/* 价签 */}
      <path d="M50 52 l12 -12 h10 v10 l-12 12 z" />
      <circle cx="68" cy="44" r="1.8" />
    </>
  ),
  "qa-review": (
    <>
      {/* 盾 */}
      <path d="M40 8 l20 7 v16 c0 14 -9 22 -20 27 c-11 -5 -20 -13 -20 -27 v-16 z" />
      {/* 勾 */}
      <path d="M31 31 l6 6 l12 -13" />
    </>
  ),
};

export function RoleMotif({ kind }: { kind: string }) {
  const motif = motifs[kind as RoleMotifKind];
  if (!motif) return null;
  return (
    <svg className="roleMotif" viewBox="0 0 80 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {motif}
    </svg>
  );
}
