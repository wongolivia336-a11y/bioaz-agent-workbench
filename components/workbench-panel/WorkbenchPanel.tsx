"use client";

import { Check, CircleAlert, PanelRight, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ResolvedInspectorPanel } from "../workbench-inspector/WorkbenchInspector";
import { useDismissableLayer } from "../workbench-shell/useDismissableLayer";

type PanelState = {
  panels: ResolvedInspectorPanel[];
  /** 当前显示的 tab 顺序按 panels 的注册顺序，不按勾选顺序，避免 tab 位置跳动 */
  visibleIds: string[];
  onVisibleIdsChange: (ids: string[]) => void;
  activePanelId: string;
  onPanelChange: (panelId: string) => void;
  /** 阶段推进过但用户没在看的 tab，打一个小圆点，不抢视图 */
  hintIds?: string[];
};

function useVisibility({ panels, visibleIds, onVisibleIdsChange, activePanelId, onPanelChange }: PanelState) {
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

  return { hide, toggleVisible };
}

/**
 * tab 栏。它住在 workspace 的 topbar 里而不是面板内部——顶栏要横贯整张白卡，
 * 分隔只发生在下方内容区，这样读起来才是「一张卡分了两个区」而不是两张卡拼接。
 */
export function WorkbenchPanelTabs(props: PanelState & { open: boolean; onToggleOpen: () => void }) {
  const { panels, visibleIds, activePanelId, onPanelChange, hintIds = [], open, onToggleOpen } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const menuRef = useDismissableLayer<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const { hide, toggleVisible } = useVisibility(props);

  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));
  const active = visiblePanels.find((panel) => panel.id === activePanelId) ?? visiblePanels[0];

  return (
    <div className={`workbenchPanelTabs ${open ? "isOpen" : ""}`}>
      {open ? (
        <>
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
                  {/* 叉号始终占位，只切换可见性——否则 hover 时 tab 变宽，整条栏会抖 */}
                  <button
                    type="button"
                    className="workbenchPanelTabClose"
                    aria-label={`关闭${panel.label}`}
                    tabIndex={visiblePanels.length > 1 ? 0 : -1}
                    disabled={visiblePanels.length === 1}
                    onClick={() => hide(panel.id)}
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
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
        </>
      ) : null}
      {/* 从面板内部关掉后指针常常正好落在这个按钮上，那一下的 hover 要压掉 */}
      <button
        type="button"
        className={`tumorInspectorToggle ${open ? "isActive" : ""} ${suppressHover ? "suppressHover" : ""}`}
        title={open ? "收起右侧面板" : "展开右侧面板"}
        aria-label={open ? "收起右侧面板" : "展开右侧面板"}
        aria-pressed={open}
        onClick={() => { if (open) setSuppressHover(true); onToggleOpen(); }}
        onMouseLeave={() => setSuppressHover(false)}
      >
        <PanelRight size={17} />
      </button>
    </div>
  );
}

/** 面板内容区，占布局第三列；tab 栏在顶栏，这里只有内容。 */
export function WorkbenchPanelBody({ panels, visibleIds, activePanelId, open = true }: Pick<PanelState, "panels" | "visibleIds" | "activePanelId"> & { open?: boolean }) {
  const visiblePanels = panels.filter((panel) => visibleIds.includes(panel.id));
  const active = visiblePanels.find((panel) => panel.id === activePanelId) ?? visiblePanels[0];

  return (
    <aside className={`workbenchPanel ${open ? "isOpen" : ""}`} aria-hidden={!open}>
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
