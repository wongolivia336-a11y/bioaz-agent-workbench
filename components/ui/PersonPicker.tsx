"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { EmptyState } from "./EmptyState";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";
import type { InboxAccount } from "../../lib/workbench/mockInbox";

/**
 * 选人。交接「交给谁」这一格用它。
 *
 * 为什么不是一个输入框
 * ----------------------------------------------------------------------
 * 之前这里是裸 `<input placeholder="姓名，例如 王林彬">`。自由文本的问题不是
 * 麻烦，是**打错了没有任何反馈**——你把活交给了一个不存在的人，而系统看起来
 * 一切正常。收件人是一个**对象**，就该长得像对象：选中之后显示成一枚 chip，
 * 没人会想去手打一枚 chip。
 *
 * 为什么带搜索
 * ----------------------------------------------------------------------
 * 通讯录只有八个人时下拉够用，到三十个人就不够了。搜索现在就加，
 * 是因为它决定了这个控件的形状(顶部一条搜索 + 下方分组列表)，
 * 而形状是后面很难改的东西。
 *
 * 每行显示 姓名 · 岗位 · 邮箱：你要把活交给一个不熟的人时，光有姓名不够。
 * 按 team 分组，是因为「他是哪条线上的」比「他姓什么」更能帮你确认选对了人。
 */
export function PersonPicker({
  people,
  value,
  onChange,
  placeholder = "选择同事",
  excludeName,
  id,
}: {
  people: InboxAccount[];
  /** 选中的人名。用姓名而不是 id，是因为工单模型里存的就是姓名。 */
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  /** 不列出自己——把活交给自己不是交接。 */
  excludeName?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));

  const candidates = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return people
      .filter((person) => person.name !== excludeName)
      .filter((person) =>
        !text ||
        `${person.name}${person.email}${person.roleLabel}${person.team}`.toLowerCase().includes(text));
  }, [people, keyword, excludeName]);

  /* 分组只是显示上的事，键盘移动走的是拍平后的那一条线——
     否则按 ↓ 到组末尾会卡住，而用户读到的是一份连续的名单。 */
  const groups = useMemo(() => {
    const map = new Map<string, InboxAccount[]>();
    for (const person of candidates) {
      if (!map.has(person.team)) map.set(person.team, []);
      map.get(person.team)!.push(person);
    }
    return Array.from(map.entries());
  }, [candidates]);

  useEffect(() => { setCursor(0); }, [keyword, open]);
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const pick = (name: string) => { onChange(name); setOpen(false); setKeyword(""); };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor((i) => Math.min(i + 1, candidates.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setCursor((i) => Math.max(i - 1, 0)); }
    if (event.key === "Enter" && candidates[cursor]) { event.preventDefault(); pick(candidates[cursor].name); }
    /* Esc 归这一层：外面那层(交接卡、弹窗)不该因为你想收起一个下拉就跟着关掉。 */
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
  };

  const selected = people.find((person: InboxAccount) => person.name === value);

  return (
    <div className="personPicker" ref={ref} onKeyDown={onKeyDown}>
      <button
        id={id}
        className={cn("personPickerField", open && "isOpen", !selected && "isEmpty")}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <span className="personChip">
            <i aria-hidden="true">{selected.name.slice(0, 1)}</i>
            <strong>{selected.name}</strong>
            <em>{selected.roleLabel}</em>
          </span>
        ) : (
          <span className="personPickerPlaceholder">{placeholder}</span>
        )}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {/* 清除单独一个按钮，不做成 chip 上的小叉:小叉挤在 chip 里点不准,
          而且它会跟「打开下拉」抢同一片区域。 */}
      {selected && !open ? (
        <button className="personPickerClear" type="button" aria-label="清除已选" onClick={() => onChange("")}>
          <X size={13} />
        </button>
      ) : null}

      {open ? (
        <div className="personPickerPanel" role="listbox" aria-label="选择同事">
          <label className="personPickerSearch">
            <Search size={13} aria-hidden="true" />
            <input
              ref={searchRef}
              value={keyword}
              placeholder="搜索姓名、岗位或邮箱"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>

          <div className="personPickerList" ref={listRef}>
            {groups.map(([team, members]) => (
              <div className="personPickerGroup" key={team}>
                <span>{team}</span>
                {members.map((person) => {
                  const index = candidates.indexOf(person);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      role="option"
                      aria-selected={person.name === value}
                      data-cursor={index === cursor ? "true" : undefined}
                      className={cn("personPickerOption", index === cursor && "isCursor", person.name === value && "isOn")}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => pick(person.name)}
                    >
                      <i aria-hidden="true">{person.name.slice(0, 1)}</i>
                      <span>
                        <strong>{person.name}</strong>
                        <small>{person.roleLabel} · {person.email}</small>
                      </span>
                      {person.name === value ? <Check size={13} /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            {/* 空结果要说话。留一片空白会让人以为控件坏了，而不是没搜到。
                用 EmptyState 的 inline 变体,不自己造第 14 种空态类名——
                audit:ui 正是为了拦住这种事,而我第一版就手搓了一个。 */}
            {!candidates.length ? <EmptyState variant="inline" title="没有匹配的同事" /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
