/**
 * 空间首页顶上那张小插画。
 *
 * 全局首页顶上是 BioAZ 的 logo——那是品牌时刻。空间首页的主角不是 BioAZ，
 * 是这个空间，所以换成空间的意象：一个文件夹，周围环绕三个节点——文件、任务、专家，
 * 各用一根虚线连回文件夹。
 *
 * 线稿，1.25px，只有一处品牌紫（文件夹的标签页和一个节点）：跟这套界面的
 * 「素、细线、强调色只用在一处」一致。不做动画——它是一张说明图，不是 loading。
 */
export function SpaceMark() {
  return (
    <div className="spaceMark" aria-hidden="true">
      <svg viewBox="0 0 132 104" role="img">
        {/* 三根虚线：节点 → 文件夹 */}
        <g className="spaceMarkLinks" fill="none" strokeWidth="1.25" strokeDasharray="3 4" strokeLinecap="round">
          <path d="M28 30 C 40 42, 48 52, 56 60" />
          <path d="M104 30 C 92 42, 84 52, 76 60" />
          <path d="M108 78 C 98 78, 90 76, 84 74" />
        </g>
        {/* 文件夹 */}
        <g className="spaceMarkFolder" strokeWidth="1.25" strokeLinejoin="round">
          <path className="spaceMarkTab" d="M42 52 h16 l6 6 h26 a4 4 0 0 1 4 4 v2 h-56 v-8 a4 4 0 0 1 4 -4z" />
          <rect x="38" y="62" width="56" height="30" rx="5" />
          <path d="M50 76 h32" strokeLinecap="round" />
          <path d="M50 83 h20" strokeLinecap="round" />
        </g>
        {/* 文件 */}
        <g className="spaceMarkNode" strokeWidth="1.25" strokeLinejoin="round">
          <path d="M16 14 h12 l6 6 v18 a2 2 0 0 1 -2 2 h-16 a2 2 0 0 1 -2 -2 v-22 a2 2 0 0 1 2 -2z" />
          <path d="M28 14 v6 h6" />
          <path d="M20 28 h10 M20 33 h7" strokeLinecap="round" />
        </g>
        {/* 任务：勾 */}
        <g className="spaceMarkNode" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="112" cy="24" r="10" />
          <path d="M107 24.5 l3.5 3.5 l6 -7" />
        </g>
        {/* 专家：带一个点的圆——品牌紫 */}
        <g className="spaceMarkNode isAccent" strokeWidth="1.25" strokeLinecap="round">
          <circle cx="118" cy="78" r="9" />
          <circle cx="118" cy="75.5" r="2.6" />
          <path d="M112.5 84 a5.5 5.5 0 0 1 11 0" />
        </g>
      </svg>
    </div>
  );
}
