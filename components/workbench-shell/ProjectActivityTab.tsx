"use client";

import { Check, Filter, FileText, MessageSquare, Upload, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismissableLayer } from "./useDismissableLayer";

type ActivityEntry = {
  id: string;
  time: string;
  actor: string;
  title: string;
  detail: string;
  icon: ReactNode;
};

const activityFeed: ActivityEntry[] = [
  { id: "act-1", time: "36 分钟前", actor: "药效报告同事", title: "生成样本 9 双批次报告 v3", detail: "校验通过 6 项，待发起专家审核", icon: <FileText size={15} /> },
  { id: "act-2", time: "1 小时前", actor: "Admin", title: "上传 batch9_raw.xlsx", detail: "归入项目资料，已供数字同事读取", icon: <Upload size={15} /> },
  { id: "act-3", time: "昨天", actor: "DMPK报价同事", title: "完成 Balb/c nude 报价单", detail: "计价规则匹配摘要已归档", icon: <Check size={15} /> },
  { id: "act-4", time: "2 天前", actor: "王 SD", title: "确认 Day28 数据口径", detail: "在任务会话中补充了历史对照说明", icon: <MessageSquare size={15} /> },
  { id: "act-5", time: "3 天前", actor: "Admin", title: "创建项目并邀请数字同事", detail: "药效报告同事、DMPK报价同事已加入", icon: <Users size={15} /> },
];

const actors = ["全部参与者", ...activityFeed.map((entry) => entry.actor).filter((actor, index, list) => list.indexOf(actor) === index)];

export function ProjectActivityTab({ project }: { project: string }) {
  const [actor, setActor] = useState("全部参与者");
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById("workbench-topbar-actions")); }, []);
  const visible = activityFeed.filter((entry) => actor === "全部参与者" || entry.actor === actor);

  return (
    <section className="projectTabPanel projectActivityPanel">
      {host ? createPortal(
        <div className="libraryToolLayer">
          <ActorFilter value={actor} options={actors} onChange={setActor} />
        </div>,
        host,
      ) : null}
      {actor !== "全部参与者" ? (
        <div className="filterChips">
          <span className="filterChip">参与者：{actor}<button type="button" onClick={() => setActor("全部参与者")} aria-label="清除参与者筛选">×</button></span>
        </div>
      ) : null}
      <ol className="projectActivityTimeline">
        {visible.map((entry) => (
          <li key={entry.id}>
            <span className="projectActivityMark" aria-hidden="true">{entry.icon}</span>
            <div className="projectActivityBody">
              <div className="projectActivityHead">
                <strong>{entry.title}</strong>
                <time>{entry.time}</time>
              </div>
              <p>{entry.detail}</p>
              <small>{entry.actor}</small>
            </div>
          </li>
        ))}
      </ol>
      {!visible.length ? (
        <div className="projectTabEmptyState">
          <strong>没有匹配的动态</strong>
          <span>换一个参与者，或清除筛选条件。</span>
        </div>
      ) : null}
    </section>
  );
}

function ActorFilter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="toolMenuWrap">
      <button className={`toolIconButton ${value !== options[0] ? "active" : ""}`} type="button" title="筛选参与者" aria-label="筛选参与者" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Filter size={16} />
      </button>
      {open ? (
        <div className="toolMenu">
          {options.map((option) => (
            <button className={`toolMenuItem ${option === value ? "active" : ""}`} type="button" key={option} onClick={() => { onChange(option); setOpen(false); }}>
              <span>{option}</span>{option === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
