"use client";

import { Bot, FileText, GitBranch, Sparkles, Users, Wand2 } from "lucide-react";

export function ProjectDashboard({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  return (
    <section className="projectDashboard">
      <header className="projectDashboardHeader">
        <button className="projectDashboardBack" type="button" onClick={onBack}>
          ← 返回
        </button>
        <h1>{projectName}</h1>
        <p>项目仪表盘 · 查看产出、Agent、Skills 和 Pod</p>
      </header>

      <div className="projectDashboardGrid">
        {/* 产出卡片 */}
        <section className="projectDashboardCard">
          <header>
            <FileText size={20} />
            <h2>产出</h2>
          </header>
          <div className="projectDashboardList">
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">📄</span>
              <div>
                <strong>报价单_v3.docx</strong>
                <small>DMPK 报价 · 2天前</small>
              </div>
            </div>
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">📊</span>
              <div>
                <strong>费用明细.xlsx</strong>
                <small>DMPK 报价 · 3天前</small>
              </div>
            </div>
          </div>
        </section>

        {/* Agents 卡片 */}
        <section className="projectDashboardCard">
          <header>
            <Bot size={20} />
            <h2>Agents</h2>
          </header>
          <div className="projectDashboardList">
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon"><Sparkles size={16} /></span>
              <div>
                <strong>DMPK 报价同事</strong>
                <small>报价参数收集 · 活跃</small>
              </div>
            </div>
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon"><Wand2 size={16} /></span>
              <div>
                <strong>药效报告同事</strong>
                <small>报告生成 · 待命</small>
              </div>
            </div>
          </div>
        </section>

        {/* Skills 卡片 */}
        <section className="projectDashboardCard">
          <header>
            <GitBranch size={20} />
            <h2>Skills</h2>
          </header>
          <div className="projectDashboardList">
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">🔍</span>
              <div>
                <strong>搜索项目文件</strong>
                <small>基于向量检索的文件查找</small>
              </div>
            </div>
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">📋</span>
              <div>
                <strong>总结关键结论</strong>
                <small>自动提取项目核心发现</small>
              </div>
            </div>
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">💡</span>
              <div>
                <strong>拓展思路方向</strong>
                <small>基于项目资料生成建议</small>
              </div>
            </div>
          </div>
        </section>

        {/* Pod 小组卡片 */}
        <section className="projectDashboardCard">
          <header>
            <Users size={20} />
            <h2>Pod 小组</h2>
          </header>
          <div className="projectDashboardList">
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">👤</span>
              <div>
                <strong>Admin</strong>
                <small>项目负责人</small>
              </div>
            </div>
            <div className="projectDashboardItem">
              <span className="projectDashboardItemIcon">🤖</span>
              <div>
                <strong>DMPK 报价同事</strong>
                <small>AI Agent · 数字同事</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
