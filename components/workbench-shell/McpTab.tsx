"use client";

import { Network } from "lucide-react";
import { useState } from "react";
import { digitalTeamData, mcpData, type McpConnector } from "../../lib/workbench/digitalTeamData";

const statusLabel: Record<McpConnector["status"], string> = {
  connected: "已连接",
  pending: "待审批",
  disconnected: "未连接",
};

const statusFilters = ["全部状态", "已连接", "待审批", "未连接"];

export function McpTab({ query }: { query: string }) {
  const [status, setStatus] = useState("全部状态");
  const nameById = new Map(digitalTeamData.map((item) => [item.id, item.displayName]));

  const keyword = query.trim().toLowerCase();
  const visible = mcpData.filter((connector) => (
    (status === "全部状态" || statusLabel[connector.status] === status)
    && (!keyword || [connector.name, connector.system, connector.scope].some((value) => value.toLowerCase().includes(keyword)))
  ));

  return (
    <>
      <div className="digitalFilterChips" role="tablist" aria-label="连接状态">
        {statusFilters.map((item) => (
          <button
            key={item}
            className={`digitalFilterChip ${status === item ? "active" : ""}`}
            type="button"
            aria-selected={status === item}
            role="tab"
            onClick={() => setStatus(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="digitalCapabilityGrid">
        {visible.map((connector) => (
          <article className="digitalCapabilityCard" key={connector.id}>
            <header>
              <span className="digitalCapabilityIcon"><Network size={16} /></span>
              <div>
                <strong>{connector.name}</strong>
                <small>{connector.system}</small>
              </div>
              <em className={`digitalStatusChip is-${connector.status}`}>
                <i className="digitalStatusDot" aria-hidden="true" />{statusLabel[connector.status]}
              </em>
            </header>
            <dl className="digitalConnectorMeta">
              <div><dt>可访问范围</dt><dd>{connector.scope}</dd></div>
              <div><dt>最后同步</dt><dd>{connector.lastSync}</dd></div>
            </dl>
            <footer>
              <span>被使用</span>
              {connector.usedBy.length
                ? connector.usedBy.map((id) => <b key={id}>{nameById.get(id) ?? id}</b>)
                : <small>暂未接入数字同事</small>}
            </footer>
          </article>
        ))}
        {!visible.length ? <div className="digitalEmptyState">没有匹配的连接器</div> : null}
      </div>
    </>
  );
}
