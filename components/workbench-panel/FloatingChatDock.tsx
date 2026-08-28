"use client";

import { ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type FloatingChatMessage = { id: string; role: "user" | "agent"; text: string };

type FloatingChatDockProps = {
  messages: FloatingChatMessage[];
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /* DMPK 里药丸是「进全屏」这个动作的结果，所以一出现就该能打字。
     QA 里它是常驻的，会话一打开就在——那时用户要读的是原件，
     抢走光标会让翻页键、退格全落进输入框。所以默认聚焦可关。 */
  autoFocus?: boolean;
  /* 药丸上方那张要当场做决定的卡（参数补全、变更确认之类）。
     ------------------------------------------------------------------
     这里原本刻意不收任何卡片，理由是「全屏是审核视角」。那条理由只对了一半：
     全屏之后**动手的地方也在全屏里**——用户在右侧面板点了「改这一项」，
     卡片却长在被画布盖住的 composer 上，等于点了没反应。

     所以卡片跟着 composer 走：composer 缩成药丸，它就落到药丸上方；
     画布收起来、对话露出来，它自然回到 composer 上方。同一张卡，两个位置，
     取决于此刻输入框在哪儿。 */
  card?: React.ReactNode;
  /* 已经选进来、等着一起发出去的参数 chips。
     药丸原本没有这一格，于是画布态下选完一个值屏幕上什么都不留——
     用户不知道刚才那一下有没有生效，也没法反悔。
     chips 跟 composer 里是同一个组件，删除方式也一样。 */
  chips?: React.ReactNode;
};

/** 播报浮层的停留时长；到点淡出，只在药丸上留一颗未读点 */
const BROADCAST_MS = 3500;

/**
 * 面板全屏时对话收成的悬浮药丸。三态：
 * 静默（只有输入框）→ 播报（agent 新消息浮在药丸上方，3.5s 后淡出留点）→ 展开（浮层对话）。
 *
 * 输入这一路仍然只有「打字 + 发送」：附件、同事切换那些属于 dock 态的 composer，
 * 收进来只会把药丸撑成第二个 composer。
 * 例外是 `card`——要当场做的决定必须跟着输入框走，见那个属性上的说明。
 */
export function FloatingChatDock({ messages, text, onTextChange, onSend, disabled = false, placeholder = "问一句，或补充说明…", autoFocus = true, card, chips }: FloatingChatDockProps) {
  const [expanded, setExpanded] = useState(false);
  const [broadcastIds, setBroadcastIds] = useState<string[]>([]);
  const [unread, setUnread] = useState(false);
  /** 已经播报过的最后一条消息，用它判断「新来了什么」，而不是比长度——消息可能被整段替换 */
  const seenIdRef = useRef(messages.at(-1)?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const lastId = messages.at(-1)?.id ?? null;
    if (lastId === seenIdRef.current) return;
    const seenIndex = messages.findIndex((message) => message.id === seenIdRef.current);
    /* 记住的那条被整段替换掉时 findIndex 返回 -1，slice(0) 会把整部历史当成新消息，
       于是把两条旧回复重新播一遍。查不到就只看最后一条。 */
    const fresh = seenIndex === -1
      ? messages.slice(-1).filter((message) => message.role === "agent")
      : messages.slice(seenIndex + 1).filter((message) => message.role === "agent");
    seenIdRef.current = lastId;
    if (!fresh.length) return;
    if (expanded) return;
    // 只播最近两条：再多就成了一块贴在药丸上的对话框，挡住画布
    setBroadcastIds(fresh.slice(-2).map((message) => message.id));
    setUnread(false);
  }, [expanded, messages]);

  // 播报到点淡出，把「有你没看的」降级成药丸上的一颗点
  useEffect(() => {
    if (!broadcastIds.length) return;
    const timer = window.setTimeout(() => {
      setBroadcastIds([]);
      setUnread(true);
    }, BROADCAST_MS);
    return () => window.clearTimeout(timer);
  }, [broadcastIds]);

  useEffect(() => {
    if (!expanded) return;
    setUnread(false);
    setBroadcastIds([]);
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [expanded, messages]);

  /* 药丸一出现就把光标放进去。全屏是「我要开始看这块内容」，
     不该再要求用户先点一下才能说话。常驻场景下由调用方关掉。 */
  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  /* Esc 一次只退一层：浮层开着就先关浮层，并且拦住事件——
     外面那层监听挂在 window 上，不拦的话浮层和全屏画布会一起消失。 */
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setExpanded(false);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [expanded]);

  const broadcasts = broadcastIds
    .map((id) => messages.find((message) => message.id === id))
    .filter((message): message is FloatingChatMessage => Boolean(message));

  /* 有 chips 就等于有东西可发，不必再打一行字。
     原来这里死守 `!text.trim()`，于是画布态下选完三项参数、发送键还是灰的——
     用户已经把要说的都选完了，系统却还在等他打字。
     composer 那边一直是这个规则（draftTabs 有值就能发），两处得一致。 */
  const canSubmit = !disabled && (text.trim().length > 0 || Boolean(chips));

  const submit = () => {
    if (!canSubmit) return;
    onSend();
  };

  return (
    <div className={`floatingChatDock ${expanded ? "isExpanded" : ""}`}>
      {expanded ? (
        <section className="floatingChatSheet" aria-label="对话">
          <header>
            <strong>对话</strong>
            <button type="button" aria-label="收起对话" onClick={() => setExpanded(false)}><ChevronDown size={14} /></button>
          </header>
          <div className="floatingChatList" ref={listRef}>
            {messages.map((message) => (
              <p key={message.id} className={message.role === "user" ? "isUser" : "isAgent"}>{message.text}</p>
            ))}
          </div>
        </section>
      ) : null}

      {broadcasts.length ? (
        <div className="floatingChatBroadcast" role="status" aria-live="polite">
          {broadcasts.map((message) => (
            <button type="button" key={message.id} onClick={() => setExpanded(true)}>{message.text}</button>
          ))}
        </div>
      ) : null}

      {card ? <div className="floatingChatCard">{card}</div> : null}

      {chips ? <div className="floatingChatChips">{chips}</div> : null}

      <div className="floatingChatPill">
        <button
          type="button"
          className={`floatingChatPillToggle ${unread ? "hasUnread" : ""}`}
          aria-label={expanded ? "收起对话" : "展开对话"}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          placeholder={placeholder}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            submit();
          }}
        />
        <button type="button" className="floatingChatSend" aria-label="发送" disabled={!canSubmit} onClick={submit}>
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
