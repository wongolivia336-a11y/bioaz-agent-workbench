"use client";

import { Check, CircleAlert, Plus } from "lucide-react";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";
import type { ResolvedInspectorPanel } from "../workbench-inspector/WorkbenchInspector";
import { useState } from "react";

type Props = {
  panels: ResolvedInspectorPanel[];
  /** 当前显示的 tab 顺序按 panels 的注册顺序，不按勾选顺序，避免 tab 位置跳动 */
  visibleIds: string[];
  onVisibleIdsChange: (ids: string[]) => void;
  activePanelId: string;
  onPanelChange: (panelId: string) => void;
  /** 阶段推进过但用户没在看的 tab，打一个小圆点，不抢视图 */
  hintIds?: string[];
};

export function WorkbenchPanel({ panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange, hintIds = [] }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));

  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));
  const active = visiblePanels.find((panel) => panel.id === activePanelId) ?? visiblePanels[0];

  const toggleVisible = (panelId: string) => {
    if (!visibleIds.includes(panelId)) {
      onVisibleIdsChange([...visibleIds, panelId]);
      onPanelChange(panelId);
      return;
    }
    // 至少留一个 tab，否则面板会变成一块没有出口的空白
    if (visibleIds.length === 1) return;
    const next = visibleIds.filter((id) => id !== panelId);
    onVisibleIdsChange(next);
    if (activePanelId === panelId) {
      const fallback = panels.find((panel) => next.includes(panel.id));
      if (fallback) onPanelChange(fallback.id);
    }
  };

  return (
    <aside className="workbenchPanel">
      <div className="workbenchPanelTabs">
        <div className="workbenchPanelTabScroll" role="tablist" aria-label="工作面板">
          {visiblePanels.map((panel) => {
            const Icon = panel.icon;
            const selected = panel.id === active?.id;
            return (
              <button
                type="button"
                role="tab"
                key={panel.id}
                aria-selected={selected}
                className={`workbenchPanelTab ${selected ? "isActive" : ""}`}
                onClick={() => onPanelChange(panel.id)}
              >
                <Icon size={14} strokeWidth={1.9} />
                <span>{panel.label}</span>
                {!selected && hintIds.includes(panel.id) ? <i className="workbenchPanelTabDot" aria-label="有更新" /> : null}
              </button>
            );
          })}
        </div>
        <div ref={menuRef} className={`workbenchPanelAdd ${menuOpen ? "isOpen" : ""}`}>
          <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="添加面板" onClick={() => setMenuOpen((value) => !value)}>
            <Plus size={16} strokeWidth={2} />
          </button>
          {menuOpen ? (
            <div className="workbenchPanelAddMenu" role="menu">
              <span className="workbenchPanelAddMenuLabel">显示面板</span>
              {panels.map((panel) => {
                const Icon = panel.icon;
                const checked = visibleIds.includes(panel.id);
                return (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    key={panel.id}
                    aria-checked={checked}
                    className={checked ? "isChecked" : ""}
                    onClick={() => toggleVisible(panel.id)}
                  >
                    <Icon size={15} strokeWidth={1.9} />
                    <span>{panel.label}</span>
                    {checked ? <Check size={14} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div className="workbenchPanelBody" role="tabpanel">
        {active ? <PanelContent panel={active} /> : null}
      </div>
    </aside>
  );
}

function PanelContent({ panel }: { panel: ResolvedInspectorPanel }) {
  if (panel.state === "error") {
    return <p className="workbenchPanelNotice isError"><CircleAlert size={15} />{panel.errorMessage ?? "内容暂时不可用"}</p>;
  }
  if (panel.state === "loading") {
    return <p className="workbenchPanelNotice">正在整理…</p>;
  }
  if (panel.state === "empty") {
    return <p className="workbenchPanelNotice">{panel.emptyMessage ?? "暂无内容"}</p>;
  }
  return <>{panel.content}</>;
}
