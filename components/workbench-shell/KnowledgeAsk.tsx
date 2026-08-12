"use client";

import { ArrowUp, ChevronDown, FileText, History, Quote, Sparkles } from "lucide-react";
import { useState } from "react";
import type { KnowledgeFile } from "../../lib/workbench/shellTypes";
import type { WorkbenchProject } from "../../modules/types";
import { useDismissableLayer } from "./useDismissableLayer";

/**
 * 跨项目视角下「资料」的主角。
 *
 * 这里不是文件柜的搜索框，是一个问答场：用户来这儿是要一个**答案**，
 * 下面那张文件表退居为"我在这些资料里问"的范围说明。
 *
 * 两条不可谈判的规矩：
 * 1. 每条回答必须挂可点的出处（哪份文件、第几页）。CRO / GxP 场景里，
 *    说不出处的答案没人敢拿去做决定，等于没答。
 * 2. 这里只答，不做事。要一件产物（报价单、报告）就得走任务流程，
 *    所以识别到"做事"的意图时转交数字同事，而不是硬答一段文字。
 */

type Citation = { file: string; locator: string };
type AskTurn = { id: string; question: string; answer: string; citations: Citation[]; handoff?: string };

const scopePresets = ["全部资料"];

const locators = ["第 2 页", "第 5-6 页", "表 3"];

/* 原型的假答案。真接上 RAG 之后这里换成检索结果，结构不变——
   「答案 + 出处数组」就是这个组件的契约。

   出处必须跟答案对得上，哪怕在原型里：一个讲样本保存的答案却引用报价单，
   演示时第一眼就会被看穿，而"出处可点"正是这套东西唯一的可信来源。 */
function pickCitations(files: KnowledgeFile[], hints: RegExp): Citation[] {
  const preferred = files.filter((file) => hints.test(file.title) || hints.test(file.kind));
  const pool = [...preferred, ...files.filter((file) => !preferred.includes(file))].slice(0, 3);
  return pool.map((file, index) => ({ file: file.title, locator: locators[index] ?? "附录" }));
}

function answerFor(question: string, scope: string, files: KnowledgeFile[]): AskTurn {
  const scopeLabel = scope === "全部资料" ? "全部资料" : `「${scope}」`;
  const wantsArtifact = /报价|出一份|生成|做一份|算一下多少钱/.test(question);
  if (wantsArtifact) {
    return {
      id: `ask-${Date.now()}`,
      question,
      answer: `我在${scopeLabel}里查到了计价依据与历史报价区间，可以作为参考。但出一份正式报价单要走任务流程、留审批轨迹，我这里只能给你依据。`,
      citations: pickCitations(files, /报价|计价|参数字典|模板/),
      handoff: "DMPK 报价同事",
    };
  }
  return {
    id: `ask-${Date.now()}`,
    question,
    answer: `根据${scopeLabel}：血浆样本采集后需在 30 分钟内完成离心并转入 -80℃ 保存；PK 参数计算采用非房室模型（NCA），AUC 用梯形法。方法学验证的接受标准为准确度 ±15%（LLOQ ±20%）。`,
    citations: pickCitations(files, /SOP|方法学|采样|保存|归档|规范|LC-MS/),
  };
}

export function KnowledgeAsk({ projects, files, onOpenFile }: { projects: WorkbenchProject[]; files: KnowledgeFile[]; onOpenFile: (file: KnowledgeFile) => void }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState(scopePresets[0]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scopeRef = useDismissableLayer<HTMLDivElement>(scopeOpen, () => setScopeOpen(false));

  const scopeOptions = [...scopePresets, ...projects.map((project) => project.name)];
  const scopedFiles = scope === "全部资料" ? files : files.filter((file) => file.project === scope);
  const latest = turns[turns.length - 1] ?? null;
  const earlier = turns.slice(0, -1);

  const submit = () => {
    const question = text.trim();
    if (!question) return;
    setTurns((current) => [...current, answerFor(question, scope, scopedFiles)]);
    setText("");
  };

  return (
    <section className="knowledgeAsk" aria-label="资料问答">
      <div className="knowledgeAskBar">
        <Sparkles size={16} className="knowledgeAskSpark" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
          placeholder="问一个问题，比如「血浆样本保存条件是什么」"
          aria-label="向资料提问"
        />
        {/* 范围选择器就是那个"电子围栏"：圈定在哪批资料里回答 */}
        <div ref={scopeRef} className="knowledgeAskScope">
          <button type="button" aria-expanded={scopeOpen} onClick={() => setScopeOpen((value) => !value)}>
            <span>{scope}</span>
            <small>{scopedFiles.length} 份</small>
            <ChevronDown size={12} />
          </button>
          {scopeOpen ? (
            <div className="toolMenu knowledgeAskScopeMenu" role="menu">
              {scopeOptions.map((option) => (
                <button className={`toolMenuItem ${option === scope ? "active" : ""}`} type="button" key={option} onClick={() => { setScope(option); setScopeOpen(false); }}>
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button className="knowledgeAskSend" type="button" disabled={!text.trim()} onClick={submit} aria-label="提问">
          <ArrowUp size={15} />
        </button>
      </div>

      {latest ? (
        <article className="knowledgeAnswer">
          <p className="knowledgeAnswerQuestion">{latest.question}</p>
          <p className="knowledgeAnswerBody">{latest.answer}</p>

          {/* 出处不是装饰，是这个答案能不能用的前提 */}
          <div className="knowledgeAnswerCitations">
            <span className="knowledgeCitationLabel"><Quote size={11} />出处</span>
            {latest.citations.map((citation) => {
              const file = files.find((item) => item.title === citation.file);
              return (
                <button
                  className="knowledgeCitation"
                  type="button"
                  key={`${citation.file}-${citation.locator}`}
                  onClick={() => { if (file) onOpenFile(file); }}
                >
                  <FileText size={11} />
                  <span>{citation.file}</span>
                  <em>{citation.locator}</em>
                </button>
              );
            })}
          </div>

          {latest.handoff ? (
            <p className="knowledgeAnswerHandoff">
              要出正式产物得走任务流程 —— 要我叫 <strong>{latest.handoff}</strong> 接手吗？
              <button type="button">交给它</button>
            </p>
          ) : null}
        </article>
      ) : null}

      {earlier.length ? (
        <div className="knowledgeAskHistory">
          <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}>
            <History size={12} />最近提问 {earlier.length} 条
            <ChevronDown size={12} className={historyOpen ? "isOpen" : ""} />
          </button>
          {historyOpen ? (
            <ol>
              {[...earlier].reverse().map((turn) => (
                <li key={turn.id}><strong>{turn.question}</strong><span>{turn.answer}</span></li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
