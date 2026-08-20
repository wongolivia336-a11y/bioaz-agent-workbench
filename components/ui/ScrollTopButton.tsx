"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

/**
 * 长内容的回顶按钮。
 *
 * 只在真的滚下去之后才出现——常驻的按钮在还没滚动时是纯噪音，而且它会一直
 * 压在内容右下角，挡住的恰恰是表格最后一列。
 *
 * 阈值 320px 约等于半屏：滚得比这浅，手指往回一划比找按钮快，按钮出来反而多余。
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
    const sync = () => setVisible(node.scrollTop > 320);
    sync();
    node.addEventListener("scroll", sync, { passive: true });
    return () => node.removeEventListener("scroll", sync);
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
