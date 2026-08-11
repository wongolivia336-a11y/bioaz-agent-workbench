"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { detectionScenarios, type DetectionScenario } from "../dmpk/catalog";

/**
 * 适用范围选择器。
 *
 * 检测类型在这套后台里是「属性」不是「目录」，所以凡是要定适用范围的地方
 * ——新增价格、上传模板、改主值——都是同一个多选动作。行为收在这里一处：
 * 恒定按 PK / BA Only / TOX 排序、至少保留一类、点一下切换。
 *
 * 两种密度：
 * - tags 紧凑标签行，用于弹窗里「顺手选一下」
 * - list 带勾选的列表行，用于抽屉——它每行还要挂例外标记和锁定态，塞不进标签
 */
export function ScenarioPicker({
  value,
  onChange,
  variant = "tags",
  minOne = true,
  renderMeta,
}: {
  value: DetectionScenario[];
  onChange: (next: DetectionScenario[]) => void;
  variant?: "tags" | "list";
  /** 至少保留一类。一个谁都不适用的条目等于被删了，不该由「取消勾选」产生 */
  minOne?: boolean;
  renderMeta?: (id: DetectionScenario) => ReactNode;
}) {
  const toggle = (id: DetectionScenario) => {
    const next = value.includes(id) ? value.filter((item) => item !== id) : [...value, id];
    if (minOne && !next.length) return;
    onChange(detectionScenarios.map((option) => option.id).filter((option) => next.includes(option)));
  };

  return (
    <div className={variant === "tags" ? "scenarioTagRow" : "scenarioOptionList"} role="group" aria-label="适用范围">
      {detectionScenarios.map((option) => {
        const on = value.includes(option.id);
        const locked = minOne && on && value.length === 1;
        return (
          <button
            className={variant === "tags" ? `scenarioTag ${on ? "active" : ""}` : `kbScopeOption ${on ? "active" : ""}`}
            type="button"
            key={option.id}
            aria-pressed={on}
            disabled={locked}
            title={locked ? "至少要保留一个适用类型" : undefined}
            onClick={() => toggle(option.id)}
          >
            {variant === "tags" ? option.short : option.label}
            {renderMeta?.(option.id)}
            {on ? <Check size={variant === "tags" ? 13 : 15} /> : null}
          </button>
        );
      })}
    </div>
  );
}
