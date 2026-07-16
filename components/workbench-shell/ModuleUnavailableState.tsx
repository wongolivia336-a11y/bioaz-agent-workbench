"use client";

import { ChevronRight, Clock3 } from "lucide-react";
import type { AgentModuleSessionProps } from "../../modules/types";

export function ModuleUnavailableState({ projectName, taskTitle, onBackToNewTask }: AgentModuleSessionProps) {
  return (
    <section className="dmpkWorkspace workbenchMode">
      <header className="topbar">
        <div className="breadcrumb">
          <span>{projectName}</span>
          <ChevronRight size={15} />
          <strong>{taskTitle}</strong>
        </div>
      </header>
      <div className="moduleUnavailableState">
        <Clock3 size={20} strokeWidth={1.8} />
        <h1>该数字同事暂未接入</h1>
        <p>任务信息已经保留。当前版本先完成 DMPK 报价模块，其他业务会沿用同一套工作台结构逐步接入。</p>
        <button className="secondaryButton compact" type="button" onClick={onBackToNewTask}>返回新建任务</button>
      </div>
    </section>
  );
}
