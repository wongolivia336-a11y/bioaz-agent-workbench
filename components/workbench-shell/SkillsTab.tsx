"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { aggregateSkills, digitalTeamData } from "../../lib/workbench/digitalTeamData";

export function SkillsTab({ query }: { query: string }) {
  const skills = useMemo(aggregateSkills, []);
  const categories = useMemo(() => ["全部分类", ...skills.map((skill) => skill.category).filter((category, index, list) => list.indexOf(category) === index)], [skills]);
  const [category, setCategory] = useState("全部分类");
  const nameById = new Map(digitalTeamData.map((item) => [item.id, item.displayName]));

  const keyword = query.trim().toLowerCase();
  const visible = skills.filter((skill) => (
    (category === "全部分类" || skill.category === category)
    && (!keyword || [skill.name, skill.category, skill.description].some((value) => value.toLowerCase().includes(keyword)))
  ));

  return (
    <>
      <div className="digitalFilterChips" role="tablist" aria-label="技能分类">
        {categories.map((item) => (
          <button
            key={item}
            className={`digitalFilterChip ${category === item ? "active" : ""}`}
            type="button"
            aria-selected={category === item}
            role="tab"
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="digitalCapabilityGrid">
        {visible.map((skill) => (
          <article className="digitalCapabilityCard" key={skill.id}>
            <header>
              <span className="digitalCapabilityIcon"><Sparkles size={16} /></span>
              <div>
                <strong>{skill.name}</strong>
                <small>{skill.category}</small>
              </div>
              <em className={`digitalStatusChip is-${skill.status}`}>{skill.status === "active" ? "已启用" : "规划中"}</em>
            </header>
            <p>{skill.description}</p>
            <footer>
              <span>被使用</span>
              {skill.usedBy.map((id: string) => <b key={id}>{nameById.get(id) ?? id}</b>)}
            </footer>
          </article>
        ))}
        {!visible.length ? <div className="digitalEmptyState">没有匹配的 Skill</div> : null}
      </div>
    </>
  );
}
