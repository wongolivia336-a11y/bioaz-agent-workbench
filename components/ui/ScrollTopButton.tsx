"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

/**
 * 长内容的回顶按钮。
 *
 * 只在真的滚下去之后才出现——常驻的按钮在还没滚动时是纯噪音，而且它会一直
 * 压在内容右下角，挡住的恰恰是表格最后一列。
 *
 * 阈值随容器走，不是写死的 320px。写死之后有个安静的坑：退回修订卡的滚动区
 * 自己才 320px 高、内容 630px，最大能滚的距离是 310——永远到不了 320，
 * 按钮在那张卡里等于不存在。所以改成「滚过自己半屏」，再用 320 封顶：
 * 大容器维持原来的手感，小容器也能在真正滚起来之后给出这颗球。
 *
 * 挂在滚动容器的**外面**（容器的定位父级里），不是里面——放进去的话它会跟着
 * 内容一起滚走，正好在你最需要它的时候消失。
 */
export function ScrollTopButton({
  targetRef,
  label = "回到顶部",
}: {
  targetRef: RefObject<HTMLElement | null>;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = targetRef.current;
    if (!node) return;
    const threshold = () => Math.min(320, Math.max(120, node.clientHeight * 0.5));
    const sync = () => setVisible(node.scrollTop > threshold());
    sync();
    node.addEventListener("scroll", sync, { passive: true });
    /* 容器高度会变（弹窗切形态、窗口缩放），阈值跟着变，得重算一次。 */
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [targetRef]);

  return (
    <button
      className={`scrollTopButton ${visible ? "isVisible" : ""}`}
      type="button"
      /* 藏起来的时候要真的退出可达序列，否则 Tab 会停在一个看不见的按钮上 */
      tabIndex={visible ? 0 : -1}
      aria-hidden={visible ? undefined : true}
      aria-label={label}
      title={label}
      onClick={() => targetRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={16} />
    </button>
  );
}
