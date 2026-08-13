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
};

/** 播报浮层的停留时长；到点淡出，只在药丸上留一颗未读点 */
const BROADCAST_MS = 3500;

/**
 * 面板全屏时对话收成的悬浮药丸。三态：
 * 静默（只有输入框）→ 播报（agent 新消息浮在药丸上方，3.5s 后淡出留点）→ 展开（浮层对话）。
 *
 * 它刻意只带「输入 + 发送」这一条最小路径：全屏是审核视角，
 * 参数补全卡、附件、同事切换那些都属于 dock 态的 composer，收进来只会把药丸撑成第二个 composer。
 */
export function FloatingChatDock({ messages, text, onTextChange, onSend, disabled = false, placeholder = "问一句，或补充说明…", autoFocus = true }: FloatingChatDockProps) {
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

  const submit = () => {
    if (disabled || !text.trim()) return;
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
        <button type="button" className="floatingChatSend" aria-label="发送" disabled={disabled || !text.trim()} onClick={submit}>
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
