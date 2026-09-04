"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 对话流跟着最新一条走。
 *
 * 为什么需要
 * ----------------------------------------------------------------------
 * `.dmpkChatScroller` 从头到尾没人动过 `scrollTop`。会话短的时候看不出来
 * ——内容还没超过一屏；一旦超过，**新消息全落在折叠线以下**，而屏幕上
 * 什么都没变。肿瘤报价走到「生成报价单」那一步实测 scrollHeight 1474、
 * 可视 816、scrollTop 0：两张产物卡就在下面，人以为点了没反应。
 *
 * 为什么不是无条件滚到底
 * ----------------------------------------------------------------------
 * 人往上翻是在看历史。这时候来一条新消息就把他拽回底部，等于把他正在读的
 * 东西抽走。所以只有**本来就贴在底部**的时候才跟——判据是离底不到一屏的
 * 四分之一（BOTTOM_SLACK）。往上翻过就停，翻回底部就自动恢复。
 *
 * `.dmpkChatScroller` 的 padding-bottom 是 320px（globals.css），
 * 滚到 scrollHeight 之后最后一条仍然在浮起来的 composer 上方，不会被压住。
 */
const BOTTOM_SLACK = 120;

export function useStickToBottom(ref: RefObject<HTMLElement>, deps: unknown[]) {
  const stuck = useRef(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => {
      stuck.current = node.scrollHeight - node.scrollTop - node.clientHeight <= BOTTOM_SLACK;
    };
    node.addEventListener("scroll", onScroll, { passive: true });

    /* 只在「消息变了」那一帧滚是不够的：每条回复左边那颗 logo 是
       `<img src="/logo/bioaz-logo.svg">`，**图片是异步加载的**，
       它撑开高度的时候 React 早就提交完了、rAF 也早就跑过了。
       实测差 233px——刚好是几条回复的图标位。而内容自己长高不会触发
       scroll 事件，所以只能盯着尺寸。
       ResizeObserver 看的是内容那一层：滚动容器自己的盒子不变，变的是里面。 */
    const observer = new ResizeObserver(() => {
      if (stuck.current) node.scrollTop = node.scrollHeight;
    });
    /* 盯每一个直接子元素，不是只盯第一个：这一层可能是
       `<PriorSessionHistory/><DmpkConversation/>` 两块，
       而长高的多半是后一块。观察容器自身没用——滚动容器的盒子不随内容变。 */
    for (const child of Array.from(node.children)) observer.observe(child);

    return () => {
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [ref]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !stuck.current) return;
    /* 先当场滚一次，再下一帧补一次。
       两次都要：这一帧 React 刚提交 DOM，图标和分组还没排完版，现在读到的
       scrollHeight 会差一截，所以需要下一帧那次；而 **rAF 在页面不可见时
       根本不会跑**（标签页在后台、窗口最小化都算），只留 rAF 的话，人切回来
       看到的是一屏停在半路的对话。同步那一次保证任何情况下都到位。 */
    node.scrollTop = node.scrollHeight;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
