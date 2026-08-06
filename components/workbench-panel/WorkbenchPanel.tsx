"use client";

import { Check, CircleAlert, PanelRight, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ResolvedInspectorPanel } from "../workbench-inspector/WorkbenchInspector";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

type Props = {
  panels: ResolvedInspectorPanel[];
  /** 当前显示的 tab 顺序按 panels 的注册顺序，不按勾选顺序，避免 tab 位置跳动 */
  visibleIds: string[];
  onVisibleIdsChange: (ids: string[]) => void;
  activePanelId: string;
  onPanelChange: (panelId: string) => void;
  /** 阶段推进过但用户没在看的 tab，打一个小圆点，不抢视图 */
  hintIds?: string[];
  /** 折叠后整列消失（宽屏）或收回屏幕右侧（窄屏），由模块的 topbar toggle 控制 */
  open?: boolean;
  onClose?: () => void;
};

export function WorkbenchPanel({
  panels,
  visibleIds,
  onVisibleIdsChange,
  activePanelId,
  onPanelChange,
  hintIds = [],
  open = true,
  onClose,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));

  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));
  const active = visiblePanels.find((panel) => panel.id === activePanelId) ?? visiblePanels[0];

  const hide = (panelId: string) => {
    // 至少留一个 tab，否则面板会变成一块没有出口的空白
    if (visibleIds.length === 1) return;
    const next = visibleIds.filter((id) => id !== panelId);
    onVisibleIdsChange(next);
    if (activePanelId === panelId) {
      const fallback = panels.find((panel) => next.includes(panel.id));
      if (fallback) onPanelChange(fallback.id);
    }
  };

  const toggleVisible = (panelId: string) => {
    if (visibleIds.includes(panelId)) { hide(panelId); return; }
    onVisibleIdsChange([...visibleIds, panelId]);
    onPanelChange(panelId);
  };

  return (
    <aside className={`workbenchPanel ${open ? "isOpen" : ""}`} aria-hidden={!open}>
      <div className="workbenchPanelTabs">
        <div className="workbenchPanelTabScroll" role="tablist" aria-label="工作面板">
          {visiblePanels.map((panel) => {
            const Icon = panel.icon;
            const selected = panel.id === active?.id;
            return (
              <span className={`workbenchPanelTab ${selected ? "isActive" : ""}`} key={panel.id}>
                <button type="button" role="tab" aria-selected={selected} onClick={() => onPanelChange(panel.id)}>
                  <Icon size={14} strokeWidth={1.9} />
                  <span>{panel.label}</span>
                  {!selected && hintIds.includes(panel.id) ? <i className="workbenchPanelTabDot" aria-label="有更新" /> : null}
                </button>
                {visiblePanels.length > 1 ? (
                  <button
                    type="button"
                    className="workbenchPanelTabClose"
                    aria-label={`关闭${panel.label}`}
                    onClick={() => hide(panel.id)}
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
                ) : null}
              </span>
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
        {onClose ? (
          <button type="button" className="workbenchPanelCollapse" aria-label="收起面板" onClick={onClose}>
            <X size={15} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div className="workbenchPanelBody" role="tabpanel">
        {active ? <PanelContent panel={active} /> : null}
      </div>
    </aside>
  );
}

/**
 * topbar 上的面板开关，两个模块共用。
 * 从面板内部关闭后指针常常正好落在露出来的按钮上，那一下的 hover 要压掉，
 * 否则看起来像面板关了但按钮又亮起来要开。
 */
export function PanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [suppressHover, setSuppressHover] = useState(false);
  return (
    <div className="sidePanelSwitch">
      <button
        type="button"
        className={`tumorInspectorToggle ${open ? "isActive" : ""} ${suppressHover ? "suppressHover" : ""}`}
        title={open ? "收起右侧面板" : "展开右侧面板"}
        aria-label={open ? "收起右侧面板" : "展开右侧面板"}
        aria-pressed={open}
        onClick={() => { if (open) setSuppressHover(true); onToggle(); }}
        onMouseLeave={() => setSuppressHover(false)}
      >
        <PanelRight size={17} />
      </button>
    </div>
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
