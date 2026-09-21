"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { CoworkerDefinition } from "../../modules/types";
import { Dialog } from "../ui";

/**
 * 「设置空间专家」——beta5 编辑空间弹窗里的「可选专家」那一栏。
 * 只管绑定，不管名字（名字在侧栏行内改）。至少留一位：一个没有专家的空间开不了任务。
 *
 * 两个入口共用这一张弹窗：侧栏行的 … 菜单，和空间首页眉题旁的「配置专家」。
 */
export function SpaceCoworkerDialog({ title, options, value, onSave, onClose }: { title: string; options: CoworkerDefinition[]; value: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(value);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <Dialog
      title="设置空间专家"
      description={`「${title}」里可以用哪些数字同事。空间首页只列这些。`}
      size="compact"
      onClose={onClose}
      footer={
        <>
          <button className="secondaryButton compact" type="button" onClick={onClose}>取消</button>
          <button className="primaryButton compact" type="button" disabled={!selected.length} onClick={() => onSave(selected)}>保存</button>
        </>
      }
    >
      <ul className="spaceCoworkerList">
        {options.map((coworker) => {
          const Icon = coworker.icon;
          const checked = selected.includes(coworker.id);
          return (
            <li key={coworker.id}>
              <label>
                <input type="checkbox" checked={checked} onChange={() => toggle(coworker.id)} />
                <span className="spaceCoworkerIcon"><Icon size={14} /></span>
                <span className="spaceCoworkerCopy"><strong>{coworker.name}</strong><small>{coworker.description}</small></span>
                {checked ? <Check size={14} aria-hidden="true" /> : null}
              </label>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
