"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";

/* 打开中的模态栈。Esc 只关最上面那一层——不分层的话，一次按键会把嵌套的
   弹窗连同它底下的抽屉一起掀掉，用户会以为自己按错了。 */
const layerStack: symbol[] = [];

/**
 * 模态的三种关闭方式里，除了叉号之外的那两种：Esc 和点击遮罩。
 *
 * 项目里 `Dialog` / `Drawer` 早就把这两条做对了，但十来个自己手写 backdrop 的
 * 弹窗全都只留了叉号。与其把它们的布局硬塞进 Dialog，不如把行为抽出来——
 * 每个模态在根部加一行，样式一点不用动。
 *
 * 用法：
 *   const dismiss = useModalDismiss(onClose);
 *   <div className="modalBackdrop" role="presentation" {...dismiss}>
 *     <section role="dialog" aria-modal="true">…</section>
 *   </div>
 *
 * 弹窗不是靠挂载卸载来开关的（比如开关状态在父组件里）时，用 `enabled`
 * 把它关掉——否则一个没显示的层会一直占着栈顶，把真正在上面那层的 Esc 吃掉。
 */
export function useModalDismiss(onClose: () => void, enabled = true) {
  /* onClose 基本都是行内箭头函数，每次渲染都换身份。放进 ref 里，
     effect 才不会跟着每次渲染反复注册和入栈。 */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const token = Symbol("modal-layer");
    layerStack.push(token);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (layerStack[layerStack.length - 1] !== token) return;
      closeRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      const index = layerStack.lastIndexOf(token);
      if (index >= 0) layerStack.splice(index, 1);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);

  /* 用 mousedown 而不是 click：在弹窗里按下、拖到遮罩上才松手（选文字选过头了
     就会这样），不该算成想关闭。click 会把这种情况判成关闭，mousedown 不会。 */
  const onMouseDown = useCallback((event: MouseEvent) => {
    if (event.target === event.currentTarget) closeRef.current();
  }, []);

  return { onMouseDown };
}
