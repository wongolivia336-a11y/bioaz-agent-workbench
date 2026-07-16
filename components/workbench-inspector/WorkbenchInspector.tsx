"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Pin,
  PinOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export type InspectorContentState = "empty" | "loading" | "populated" | "error";

export type InspectorPanelDefinition<TContext> = {
  id: string;
  label: string;
  icon: LucideIcon;
  available?: (context: TContext) => boolean;
  defaultWhen?: (context: TContext) => boolean;
  state?: (context: TContext) => InspectorContentState;
  emptyMessage?: string;
  errorMessage?: string;
  render: (context: TContext) => ReactNode;
};

export type InspectorPanelRegistry<TContext> = readonly InspectorPanelDefinition<TContext>[];

export type ResolvedInspectorPanel = {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
  state: InspectorContentState;
  isDefault: boolean;
  emptyMessage?: string;
  errorMessage?: string;
};

export function resolveInspectorPanels<TContext>(
  registry: InspectorPanelRegistry<TContext>,
  context: TContext,
): ResolvedInspectorPanel[] {
  return registry
    .filter((panel) => panel.available?.(context) ?? true)
    .map((panel) => ({
      id: panel.id,
      label: panel.label,
      icon: panel.icon,
      content: panel.render(context),
      state: panel.state?.(context) ?? "populated",
      isDefault: panel.defaultWhen?.(context) ?? false,
      emptyMessage: panel.emptyMessage,
      errorMessage: panel.errorMessage,
    }));
}

type WorkbenchInspectorProps = {
  panels: ResolvedInspectorPanel[];
  activePanelId: string;
  open: boolean;
  pinned: boolean;
  onOpenChange: (open: boolean) => void;
  onPinnedChange: (pinned: boolean) => void;
  onPanelChange: (panelId: string) => void;
};

export function WorkbenchInspector({
  panels,
  activePanelId,
  open,
  pinned,
  onOpenChange,
  onPinnedChange,
  onPanelChange,
}: WorkbenchInspectorProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<number | null>(null);
  const visible = open || pinned;

  const fallbackPanel = useMemo(
    () => panels.find((panel) => panel.isDefault) ?? panels[0],
    [panels],
  );
  const activePanel = panels.find((panel) => panel.id === activePanelId) ?? fallbackPanel;

  useEffect(() => {
    if (fallbackPanel && !panels.some((panel) => panel.id === activePanelId)) {
      onPanelChange(fallbackPanel.id);
    }
  }, [activePanelId, fallbackPanel, onPanelChange, panels]);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !visible;
    if (!visible) setSelectorOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!selectorOpen) return;
    const activeIndex = Math.max(0, panels.findIndex((panel) => panel.id === activePanel?.id));
    const focusFrame = window.requestAnimationFrame(() => menuItemRefs.current[activeIndex]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [activePanel?.id, panels, selectorOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectorOpen) {
        setSelectorOpen(false);
        return;
      }
      if (visible && !pinned) onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, pinned, selectorOpen, visible]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const cancelClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleClose = () => {
    if (pinned) return;
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 140);
  };

  const openInspector = () => {
    cancelClose();
    onOpenChange(true);
  };

  const moveMenuFocus = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = panels.length - 1;
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowDown"
          ? (index + 1) % panels.length
          : (index - 1 + panels.length) % panels.length;
    menuItemRefs.current[next]?.focus();
  };

  const ActiveIcon = activePanel?.icon ?? Inbox;

  return (
    <>
      {!pinned ? (
        <div
          className="workbenchInspectorHotZone"
          aria-hidden="true"
          onMouseEnter={openInspector}
          onMouseLeave={scheduleClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={`workbenchInspector ${visible ? "isOpen" : ""} ${pinned ? "isPinned" : ""}`}
        aria-hidden={!visible}
        aria-label="工作台详情面板"
        onMouseEnter={openInspector}
        onMouseLeave={scheduleClose}
      >
        <header className="workbenchInspectorHeader">
          <div className="workbenchPanelSelector" ref={selectorRef}>
            <button
              className="workbenchPanelSelectorTrigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={selectorOpen}
              disabled={!panels.length}
              onClick={() => setSelectorOpen((current) => !current)}
            >
              <ActiveIcon size={16} />
              <span>{activePanel?.label ?? "暂无可用面板"}</span>
              <ChevronRight className={selectorOpen ? "isOpen" : ""} size={15} />
            </button>
            {selectorOpen ? (
              <div className="workbenchPanelSelectorMenu" role="menu" aria-label="选择详情面板">
                {panels.map((panel, index) => {
                  const Icon = panel.icon;
                  return (
                    <button
                      key={panel.id}
                      ref={(element) => { menuItemRefs.current[index] = element; }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={activePanel?.id === panel.id}
                      onKeyDown={(event) => moveMenuFocus(event, index)}
                      onClick={() => {
                        onPanelChange(panel.id);
                        setSelectorOpen(false);
                      }}
                    >
                      <Icon size={16} />
                      <span>{panel.label}</span>
                      {activePanel?.id === panel.id ? <Check size={16} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="workbenchInspectorControls">
            <button
              type="button"
              aria-label={pinned ? "取消固定详情面板" : "固定详情面板"}
              onClick={() => {
                onPinnedChange(!pinned);
                onOpenChange(true);
              }}
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          </div>
        </header>
        <div className="workbenchInspectorBody">
          {!activePanel ? (
            <InspectorState icon={Inbox} title="当前阶段暂无可用面板" />
          ) : activePanel.state === "loading" ? (
            <InspectorState icon={LoaderCircle} title="正在同步工作上下文" loading />
          ) : activePanel.state === "error" ? (
            <InspectorState icon={TriangleAlert} title={activePanel.errorMessage ?? "面板加载失败"} />
          ) : activePanel.state === "empty" ? (
            <InspectorState icon={Inbox} title={activePanel.emptyMessage ?? "暂无内容"} />
          ) : (
            activePanel.content
          )}
        </div>
      </aside>
    </>
  );
}

function InspectorState({
  icon: Icon,
  title,
  loading = false,
}: {
  icon: LucideIcon;
  title: string;
  loading?: boolean;
}) {
  return (
    <div className="workbenchInspectorState" role={loading ? "status" : undefined}>
      <Icon className={loading ? "isSpinning" : ""} size={20} />
      <span>{title}</span>
    </div>
  );
}
