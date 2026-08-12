"use client";

import { Bot, Check, Clock3, Filter, FileText, MessageSquare, ShieldCheck, TriangleAlert, Upload, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { inboxItems, type InboxAccount } from "../../lib/workbench/mockInbox";
import { useDismissableLayer } from "./useDismissableLayer";
import { EmptyState } from "../ui";

type ActivityEntry = {
  id: string;
  group: string;
  time: string;
  actor: string;
  kind: string;
  title: string;
  detail: string;
  icon: ReactNode;
  /** 项目归属。跨项目视角要靠它筛，项目内视角要靠它过滤 */
  project?: string;
  /** 这条是不是"冲着我来的"——收件箱动态栏并进来之后才有的区分 */
  mine?: boolean;
};

const activityFeed: ActivityEntry[] = [
  { id: "act-1", group: "今天", time: "36 分钟前", actor: "药效报告同事", kind: "产物", title: "生成样本 9 双批次报告 v3", detail: "校验通过 6 项，3 条风险待授权确认", icon: <FileText size={14} /> },
  { id: "act-2", group: "今天", time: "1 小时前", actor: "Admin", kind: "资料", title: "上传 batch9_raw.xlsx", detail: "归入项目资料，已供数字同事读取", icon: <Upload size={14} /> },
  { id: "act-3", group: "今天", time: "2 小时前", actor: "QA 审核同事", kind: "审核", title: "完成数据质控与证据追溯", detail: "终点日缺失值需要研究总监确认", icon: <ShieldCheck size={14} /> },
  { id: "act-4", group: "今天", time: "3 小时前", actor: "李助理", kind: "阻塞", title: "历史对照组数据补充受阻", detail: "上游实验室尚未回传，预计顺延 2 天", icon: <TriangleAlert size={14} /> },
  { id: "act-5", group: "本周", time: "昨天", actor: "DMPK 报价同事", kind: "产物", title: "完成 Balb/c nude 报价单", detail: "计价规则匹配摘要已归档", icon: <Check size={14} /> },
  { id: "act-6", group: "本周", time: "2 天前", actor: "王 SD", kind: "决策", title: "确认 Day28 数据口径", detail: "在任务会话中补充了历史对照说明", icon: <MessageSquare size={14} /> },
  { id: "act-7", group: "本周", time: "3 天前", actor: "张经理", kind: "计划", title: "调整阶段三交付时间", detail: "报告交付由 07-31 顺延至 08-02", icon: <Clock3 size={14} /> },
  { id: "act-8", group: "更早", time: "5 天前", actor: "Admin", kind: "成员", title: "创建项目并邀请数字同事", detail: "药效报告同事、DMPK 报价同事已加入", icon: <Users size={14} /> },
];

const activityGroups = ["今天", "本周", "更早"];

// 相对文案归档到分组，跟 FileManager 的时间桶同一套判据
function groupOf(time: string): string {
  if (/刚刚|分钟前|小时前/.test(time)) return "今天";
  if (/昨天|^[1-7]\s*天前/.test(time)) return "本周";
  return "更早";
}

/* 收件箱原来那条「动态」栏并到这里。
   两个「动态」是上一轮我自己做出来的重复——同一个词摆在两个地方，用户不知道
   该看哪个。合并之后只留一条流，用「只看与我有关」把原来收件箱那栏的语义
   保住：那些冲着我岗位来的流转，勾上开关就只剩它们。 */
function inboxFeedEntries(account: InboxAccount): ActivityEntry[] {
  return inboxItems
    .filter((item) => item.lane === "feed")
    .map((item) => ({
      id: `feed-${item.id}`,
      group: groupOf(item.time),
      time: item.time,
      actor: item.actorName,
      kind: "流转",
      title: `${item.docTitle} · ${item.summary.replace(/。.*$/, "")}`,
      detail: item.summary,
      icon: item.agent ? <Bot size={14} /> : <FileText size={14} />,
      project: item.project,
      mine: item.audienceRole === account.role,
    }));
}

export function ProjectActivityTab({ project, account }: { project: string; account: InboxAccount }) {
  const [actor, setActor] = useState("全部参与者");
  const [kind, setKind] = useState("全部类型");
  const [mineOnly, setMineOnly] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById("workbench-topbar-actions")); }, []);

  const feed = useMemo(() => [...activityFeed, ...inboxFeedEntries(account)], [account]);
  const actors = useMemo(() => ["全部参与者", ...feed.map((entry) => entry.actor).filter((value, index, list) => list.indexOf(value) === index)], [feed]);
  const kinds = useMemo(() => ["全部类型", ...feed.map((entry) => entry.kind).filter((value, index, list) => list.indexOf(value) === index)], [feed]);

  const visible = feed.filter((entry) => (
    (actor === "全部参与者" || entry.actor === actor)
    && (kind === "全部类型" || entry.kind === kind)
    && (!mineOnly || entry.mine)
    // 项目筛选器选中某个项目时，没有归属的老 mock 条目仍然显示——它们本来就是项目内动态
    && (project === "全部项目" || !entry.project || entry.project === project)
  ));

  return (
    <section className="projectTabPanel projectActivityPanel">
      {host ? createPortal(
        <div className="libraryToolLayer">
          <button
            className={`activityMineToggle ${mineOnly ? "isOn" : ""}`}
            type="button"
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((value) => !value)}
          >
            只看与我有关
          </button>
          <ActivityFilter icon={<Users size={16} />} label="筛选参与者" value={actor} options={actors} onChange={setActor} />
          <ActivityFilter icon={<Filter size={16} />} label="筛选事件类型" value={kind} options={kinds} onChange={setKind} />
        </div>,
        host,
      ) : null}
      {(actor !== "全部参与者" || kind !== "全部类型") ? (
        <div className="filterChips">
          {actor !== "全部参与者" ? <span className="filterChip">参与者：{actor}<button type="button" onClick={() => setActor("全部参与者")} aria-label="清除参与者筛选">×</button></span> : null}
          {kind !== "全部类型" ? <span className="filterChip">类型：{kind}<button type="button" onClick={() => setKind("全部类型")} aria-label="清除类型筛选">×</button></span> : null}
          <button className="clearAllChips" type="button" onClick={() => { setActor("全部参与者"); setKind("全部类型"); }}>清除全部</button>
        </div>
      ) : null}
      {activityGroups.map((group) => {
        const rows = visible.filter((entry) => entry.group === group);
        if (!rows.length) return null;
        return (
          <section className="projectActivityGroup" key={group}>
            <header className="projectActivityGroupHead">{group}<span>{rows.length}</span></header>
            <ol className="projectActivityTimeline">
              {rows.map((entry) => (
                <li key={entry.id}>
                  <span className="projectActivityMark" aria-hidden="true">{entry.icon}</span>
                  <div className="projectActivityBody">
                    <div className="projectActivityHead">
                      <strong>{entry.title}</strong>
                      <em className="projectActivityKind">{entry.kind}</em>
                      <time>{entry.time}</time>
                    </div>
                    <p>{entry.detail}</p>
                    <small>{entry.actor}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {!visible.length ? (
        <EmptyState title="没有匹配的动态" description={mineOnly ? "关掉「只看与我有关」看全部动态。" : "换一个参与者，或清除筛选条件。"} />
      ) : null}
    </section>
  );
}

function ActivityFilter({ icon, label, value, options, onChange }: { icon: ReactNode; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissableLayer<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="toolMenuWrap">
      <button className={`toolIconButton ${value !== options[0] ? "active" : ""}`} type="button" title={label} aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {icon}
      </button>
      {open ? (
        <div className="toolMenu">
          {options.map((option) => (
            <button className={`toolMenuItem ${option === value ? "active" : ""}`} type="button" key={option} onClick={() => { onChange(option); setOpen(false); }}>
              <span>{option}</span>{option === value ? <Check size={12} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
