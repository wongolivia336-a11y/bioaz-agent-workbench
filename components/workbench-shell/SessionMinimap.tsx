"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * 会话缩略导航（Hover-driven Minimap Navigation）。
 *
 * 三条约束定义了它：
 *   1. Stable Scroll State —— 滚动**不**改变它的视觉状态。它只对指针的横向距离
 *      有反应，不对 scrollTop 有反应。所以下面的 reveal 只由 pointermove 算，
 *      scroll 事件只在已经露出来的时候才用来重算波峰位置。
 *   2. Proximity Reveal —— 指针进入右边缘 120px 才开始淡入，32px 内全显。
 *      不是 hover 在某个元素上，是「靠近边缘」这件事本身。
 *   3. Fisheye —— 离指针越近的刻度越长，形成一条波峰。用 transform: scaleX
 *      做，不动 width，否则每帧都要重排。
 *
 * 锚点靠 DOM 扫描，不靠 props 传递：宿主在自己的节点上写 data-minimap，
 * 三套结构完全不同的会话（dmpk / qa-review / legacy 肿瘤）就能共用这一个组件。
 */

export type MinimapKind = "user" | "agent" | "activity" | "artifact" | "divider";

type MinimapNode = { key: string; kind: MinimapKind; label: string; top: number; height: number };
type Layout = { nodes: MinimapNode[]; contentStart: number; contentSpan: number; scrollHeight: number; clientHeight: number };
type Frame = { top: number; right: number; height: number };

/** 指针离右边缘多远开始淡入 */
const BAND_START = 120;
/** 指针离右边缘多近算全显 */
const BAND_FULL = 32;
/** 波峰的高斯半径：离指针这么远时刻度基本回到基准长度 */
const FISHEYE_RADIUS = 110;
const RAIL_INSET_Y = 30;
const TICK_MAX = 34;
const LABEL_MIN_REVEAL = 0.55;
const INTERACTIVE_REVEAL = 0.45;
/* 纹理线的行距。只有语义节点做刻度的话，8 条消息摊在 600px 轨道上
   每 75px 才一根，读起来是一排零散的虚线而不是一张地图。
   在节点自己的高度范围内按这个行距补淡线，轨道才有轮廓。 */
const GRAIN_STEP = 16;
const ANCHOR_BASE = 0.55;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/* 纹理线的长度：确定性的伪随机，长短不一才像文本行。
   用 index 当种子而不是 Math.random，否则每帧重渲染都会重新抽一次，整条轨道会抖。 */
function grainWidth(nodeIndex: number, lineIndex: number) {
  const seed = Math.sin(nodeIndex * 12.9898 + lineIndex * 78.233) * 43758.5453;
  return 0.2 + 0.3 * (seed - Math.floor(seed));
}

function readLabel(el: HTMLElement) {
  const raw = el.dataset.minimapLabel ?? el.textContent ?? "";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "会话节点";
  return text.length > 22 ? `${text.slice(0, 22)}…` : text;
}

/* 缩略图挂在最近的定位祖先上，而不是插进 scroller 里。
   scroller 内部的绝对定位会跟着内容滚，sticky 又会在顶部那几十像素抖一下——
   两者都会让「滚动时保持稳定」这条失效。挂在外面用测量出的矩形对齐最干净。 */
function findPositionedAncestor(el: HTMLElement): HTMLElement {
  let node = el.parentElement;
  while (node && node !== document.body) {
    if (window.getComputedStyle(node).position !== "static") return node;
    node = node.parentElement;
  }
  return document.body;
}

export function SessionMinimap({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const [enabled, setEnabled] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [view, setView] = useState({ reveal: 0, pointerY: -1, scrollTop: 0 });

  const hostRef = useRef<HTMLElement | null>(null);
  const signatureRef = useRef("");
  const pointerRef = useRef({ x: -1, y: -1, inside: false });
  const measureFrameRef = useRef(0);
  const viewFrameRef = useRef(0);
  const revealRef = useRef(0);

  // 触屏没有 hover，也没有「靠近边缘」这个动作，整个组件不挂载
  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setEnabled(hoverQuery.matches);
      setReduceMotion(motionQuery.matches);
    };
    sync();
    hoverQuery.addEventListener("change", sync);
    motionQuery.addEventListener("change", sync);
    return () => {
      hoverQuery.removeEventListener("change", sync);
      motionQuery.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!enabled || !scroller) return;
    const ancestor = findPositionedAncestor(scroller);
    hostRef.current = ancestor;
    setHost(ancestor);
  }, [enabled, scrollerRef]);

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    const ancestor = hostRef.current;
    if (!scroller || !ancestor) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const hostRect = ancestor.getBoundingClientRect();
    const scrollTop = scroller.scrollTop;
    const nodes: MinimapNode[] = [];

    scroller.querySelectorAll<HTMLElement>("[data-minimap]").forEach((el, index) => {
      // 产物卡这类容器里还嵌着一条 agentReply，两个锚点会落在几乎同一个位置
      if (el.parentElement?.closest("[data-minimap]")) return;
      const rect = el.getBoundingClientRect();
      if (!rect.height) return;
      nodes.push({
        key: `${index}:${el.dataset.minimap}`,
        kind: (el.dataset.minimap as MinimapKind) || "agent",
        label: readLabel(el),
        top: rect.top - scrollerRect.top + scrollTop,
        height: rect.height,
      });
    });

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    /* 按内容实际跨度归一化，而不是按 scrollHeight——scroller 底部留着
       320px 给 composer 让位，用 scrollHeight 会让最后一条消息停在轨道 70% 处，
       下面空一大截。 */
    const contentStart = first ? first.top : 0;
    const contentSpan = Math.max(1, last ? last.top + last.height - contentStart : 1);
    /* 绝对定位的包含块是祖先的 padding box，不是 border box——祖先有边框时
       直接拿 getBoundingClientRect 会整体偏掉一个边框宽度 */
    const hostStyle = window.getComputedStyle(ancestor);
    const nextFrame: Frame = {
      top: scrollerRect.top - (hostRect.top + parseFloat(hostStyle.borderTopWidth || "0")) + ancestor.scrollTop,
      right: hostRect.right - parseFloat(hostStyle.borderRightWidth || "0") - scrollerRect.right,
      height: scrollerRect.height,
    };

    // MutationObserver 会被本组件自己的重渲染触发，签名相同就不再 setState，否则会自激
    const signature = [
      nodes.map((node) => `${node.key}|${Math.round(node.top)}|${Math.round(node.height)}|${node.label}`).join(";"),
      Math.round(scroller.scrollHeight),
      Math.round(scroller.clientHeight),
      Math.round(nextFrame.top),
      Math.round(nextFrame.right),
      Math.round(nextFrame.height),
    ].join("#");
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;

    setLayout({ nodes, contentStart, contentSpan, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight });
    setFrame(nextFrame);
  }, [scrollerRef]);

  const scheduleMeasure = useCallback(() => {
    if (measureFrameRef.current) return;
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = 0;
      measure();
    });
  }, [measure]);

  const syncView = useCallback(() => {
    if (viewFrameRef.current) return;
    viewFrameRef.current = window.requestAnimationFrame(() => {
      viewFrameRef.current = 0;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const pointer = pointerRef.current;
      let reveal = 0;
      let pointerY = -1;
      if (pointer.inside) {
        const distance = rect.right - pointer.x;
        reveal = clamp((BAND_START - distance) / (BAND_START - BAND_FULL), 0, 1);
        pointerY = pointer.y - rect.top;
      }
      // 刚进感应带才重测一次。节点的内容坐标不随滚动变，滚动时重测纯属浪费
      if (reveal > 0 && revealRef.current === 0) scheduleMeasure();
      revealRef.current = reveal;
      const scrollTop = scroller.scrollTop;
      setView((prev) => {
        // 藏着的时候滚动条位置怎么变都不用重渲染
        if (prev.reveal === 0 && reveal === 0) return prev;
        if (prev.reveal === reveal && prev.pointerY === pointerY && prev.scrollTop === scrollTop) return prev;
        return { reveal, pointerY, scrollTop };
      });
    });
  }, [scheduleMeasure, scrollerRef]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!enabled || !scroller || !host) return;

    // 首次同步量一遍。走 rAF 的话，标签页在后台时 rAF 不触发，
    // 会话就一直没有缩略图可用——切回来才补上，白等一次。
    measure();

    const mutations = new MutationObserver(scheduleMeasure);
    mutations.observe(scroller, { childList: true, subtree: true, characterData: true });
    const resizes = new ResizeObserver(() => {
      scheduleMeasure();
      syncView();
    });
    resizes.observe(scroller);
    resizes.observe(host);

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, inside: true };
      syncView();
    };
    const onPointerLeave = () => {
      pointerRef.current = { x: -1, y: -1, inside: false };
      syncView();
    };
    // 滚动只更新「当前在哪一段」的高亮，而且只在已经露出来的时候才算
    const onScroll = () => {
      if (pointerRef.current.inside) syncView();
    };

    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerleave", onPointerLeave);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(measureFrameRef.current);
      window.cancelAnimationFrame(viewFrameRef.current);
      measureFrameRef.current = 0;
      viewFrameRef.current = 0;
      mutations.disconnect();
      resizes.disconnect();
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerleave", onPointerLeave);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [enabled, host, measure, scheduleMeasure, scrollerRef, syncView]);

  if (!enabled || !host || !layout || !frame) return null;

  const { nodes, contentStart, contentSpan, scrollHeight, clientHeight } = layout;
  // 内容没长到要导航的程度就别出现
  if (nodes.length < 3 || scrollHeight <= clientHeight + 48) return null;

  const railHeight = Math.max(48, frame.height - RAIL_INSET_Y * 2);
  const positions = nodes.map((node) => RAIL_INSET_Y + ((node.top - contentStart) / contentSpan) * railHeight);

  /* 纹理填的是刻度之间的空隙，不是节点自己的高度范围。
     一开始按后者写，结果是节点越多每段越短、纹理越生不出来——正好反了：
     13 个锚点压进 396px 轨道时每段只有 30px，一条纹理都排不下。
     按空隙填，全轨道间距恒定，密度与节点数无关。 */
  const lastNode = nodes[nodes.length - 1];
  const railEnd = positions[positions.length - 1] + (lastNode.height / contentSpan) * railHeight;
  const grain: { key: string; y: number; base: number }[] = [];
  positions.forEach((start, index) => {
    const stop = index + 1 < positions.length ? positions[index + 1] : railEnd;
    let line = 1;
    for (let y = start + GRAIN_STEP; y < stop - GRAIN_STEP * 0.5; y += GRAIN_STEP) {
      grain.push({ key: `${index}-${line}`, y, base: grainWidth(index, line) });
      line += 1;
    }
  });

  // 「你现在在哪一段」取视口上三分之一处那条线，比取顶边更贴合阅读位置
  const focusLine = view.scrollTop + clientHeight * 0.3;
  let currentIndex = 0;
  nodes.forEach((node, index) => {
    if (node.top <= focusLine) currentIndex = index;
  });

  let labelIndex = -1;
  if (view.reveal >= LABEL_MIN_REVEAL && view.pointerY >= 0) {
    let best = Number.POSITIVE_INFINITY;
    positions.forEach((y, index) => {
      const distance = Math.abs(y - view.pointerY);
      if (distance < best) {
        best = distance;
        labelIndex = index;
      }
    });
  }

  const jumpTo = (node: MinimapNode) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: Math.max(0, node.top - 16), behavior: reduceMotion ? "auto" : "smooth" });
  };

  return createPortal(
    <div
      className="sessionMinimap"
      aria-hidden="true"
      style={{
        top: frame.top,
        right: frame.right,
        height: frame.height,
        opacity: view.reveal,
        pointerEvents: view.reveal > INTERACTIVE_REVEAL ? "auto" : "none",
      }}
    >
      {/* 这里原本还有一条 1px 的脊线，删了：它落在面板左边框内侧 14.5px 处，
          两条宽度相同、颜色相近（8% / 6% 黑）的竖线并排，会被读成同一条线画歪了。
          刻度的右端本来就对齐成一条隐含的线，纹理补满之后不需要再描一遍。 */}
      {grain.map((line) => {
        const falloff = view.pointerY < 0 ? 0 : Math.exp(-(((line.y - view.pointerY) / FISHEYE_RADIUS) ** 2));
        return (
          <span
            key={line.key}
            className="sessionMinimapGrain"
            style={{
              top: line.y,
              transform: `scaleX(${(line.base + (0.85 - line.base) * falloff).toFixed(4)})`,
              opacity: 0.34 + 0.46 * falloff,
            }}
          />
        );
      })}
      {nodes.map((node, index) => {
        const y = positions[index];
        const falloff = view.pointerY < 0 ? 0 : Math.exp(-(((y - view.pointerY) / FISHEYE_RADIUS) ** 2));
        const scale = ANCHOR_BASE + (1 - ANCHOR_BASE) * falloff;
        return (
          <button
            key={node.key}
            className="sessionMinimapTick"
            type="button"
            tabIndex={-1}
            data-kind={node.kind}
            data-current={index === currentIndex ? "true" : "false"}
            style={{ top: y }}
            onClick={() => jumpTo(node)}
          >
            <i style={{ transform: `scaleX(${scale.toFixed(4)})`, opacity: 0.3 + 0.7 * falloff }} />
          </button>
        );
      })}
      {labelIndex >= 0 ? (
        <span className="sessionMinimapLabel" data-kind={nodes[labelIndex].kind} style={{ top: positions[labelIndex] }}>
          {nodes[labelIndex].label}
        </span>
      ) : null}
    </div>,
    host,
  );
}
