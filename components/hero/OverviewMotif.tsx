/**
 * 空间概览三张小卡右侧的线稿：文件 / 产物 / 任务各一张。
 * 跟 RoleMotif 同一套笔触（1.2 线宽、圆头、currentColor），颜色由 CSS 管——
 * 静态是淡灰，hover 深一档。它们比专家卡的底纹稍微"在"一点：这张卡上没有图标，
 * 线稿就是它唯一的图像。
 */
export type OverviewMotifKind = "files" | "artifacts" | "tasks";

const motifs: Record<OverviewMotifKind, JSX.Element> = {
  files: (
    <>
      {/* 一叠纸 + 一个文件夹口 */}
      <path d="M14 20 h20 l4 4 h22 a3 3 0 0 1 3 3 v24 a3 3 0 0 1 -3 3 h-46 a3 3 0 0 1 -3 -3 v-28 a3 3 0 0 1 3 -3z" />
      <path d="M11 31 h52" />
      <path d="M22 12 h26 M26 6 h18" />
    </>
  ),
  artifacts: (
    <>
      {/* 一页产物 + 右下角一枚印 */}
      <path d="M20 6 h22 l10 10 v38 a3 3 0 0 1 -3 3 h-29 a3 3 0 0 1 -3 -3 v-45 a3 3 0 0 1 3 -3z" />
      <path d="M42 6 v10 h10" />
      <path d="M26 26 h20 M26 33 h20 M26 40 h12" />
      <circle cx="50" cy="50" r="8" />
      <path d="M46.5 50 l2.5 2.5 l5 -5" />
    </>
  ),
  tasks: (
    <>
      {/* 三行清单，前两行打了勾，第三行还空着 */}
      <rect x="14" y="10" width="10" height="10" rx="2" />
      <path d="M17 15 l2 2 l4 -4 M30 15 h24" />
      <rect x="14" y="27" width="10" height="10" rx="2" />
      <path d="M17 32 l2 2 l4 -4 M30 32 h24" />
      <rect x="14" y="44" width="10" height="10" rx="2" />
      <path d="M30 49 h16" />
    </>
  ),
};

export function OverviewMotif({ kind }: { kind: OverviewMotifKind }) {
  return (
    <svg className="overviewMotif" viewBox="0 0 68 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {motifs[kind]}
    </svg>
  );
}
