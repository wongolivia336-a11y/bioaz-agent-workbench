"use client";

import { Check, FileText, MessageSquare, Upload, Users } from "lucide-react";
import type { ReactNode } from "react";

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

export function ProjectActivityTab({ project }: { project: string }) {
  return (
    <section className="projectTabPanel projectActivityPanel">
      <div className="projectTabIntro">
        <strong>项目动态</strong>
        <span>{project} 下的关键事件与数字同事协作记录。</span>
      </div>
      <ol className="projectActivityTimeline">
        {activityFeed.map((entry) => (
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
      <p className="projectTabPlaceholderNote">当前为示意数据，后续将接入真实项目事件流。</p>
    </section>
  );
}
