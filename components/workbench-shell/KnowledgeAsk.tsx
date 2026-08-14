"use client";

import { ArrowUp, ChevronDown, FileText, History, Quote, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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

/* 建议问题。三条**必须走到三个不同的分支**——两张卡点下去吐同一段话，
   演示时第一眼就穿帮，跟当初 files.slice(0,3) 引错出处是同一类错误。 */
export const askSuggestions = [
  "血浆样本保存条件是什么",
  "报告归档的命名规则怎么定",
  "这次 DMPK 的计价依据是什么",
];

function answerFor(question: string, scope: string, files: KnowledgeFile[]): AskTurn {
  const scopeLabel = scope === "全部资料" ? "全部资料" : `「${scope}」`;
  const id = `ask-${Date.now()}`;
  if (/报价|计价|出一份|生成|做一份|算一下多少钱/.test(question)) {
    return {
      id,
      question,
      answer: `我在${scopeLabel}里查到了计价依据与历史报价区间，可以作为参考。但出一份正式报价单要走任务流程、留审批轨迹，我这里只能给你依据。`,
      citations: pickCitations(files, /报价|计价|参数字典|模板/),
      handoff: "DMPK 报价同事",
    };
  }
  if (/归档|命名|审计|留痕|溯源/.test(question)) {
    return {
      id,
      question,
      answer: `根据${scopeLabel}：归档包统一按「报告编号_版本_日期」命名；原始记录与终版报告一并入库，审计轨迹保留全部版本，已生效满 30 天的交付包自动归档。`,
      citations: pickCitations(files, /归档|审计|溯源|记录|规范/),
    };
  }
  return {
    id,
    question,
    answer: `根据${scopeLabel}：血浆样本采集后需在 30 分钟内完成离心并转入 -80℃ 保存；PK 参数计算采用非房室模型（NCA），AUC 用梯形法。方法学验证的接受标准为准确度 ±15%（LLOQ ±20%）。`,
    citations: pickCitations(files, /SOP|方法学|采样|保存|归档|规范|LC-MS/),
  };
}

/**
 * 一个组件，两种停靠：
 *   dock="inline"   跨项目视角，问答就是来这儿的目的，所以停在内容顶部
 *   dock="floating" 项目内，翻文件才是目的，问答随手可用，所以浮在底部
 *
 * 停靠位置变，控件不变——同一个输入框、同一个范围下拉、同一套带出处的答案。
 * 项目内那颗胶囊原来把范围写死成「当前项目」，换成同一个下拉之后，你在项目
 * 里也能临时把范围放大到全部资料或某个资料空间。
 */
export function KnowledgeAsk({ projects, files, onOpenFile, dock = "inline", defaultScope }: { projects: WorkbenchProject[]; files: KnowledgeFile[]; onOpenFile: (file: KnowledgeFile) => void; dock?: "inline" | "floating"; defaultScope?: string }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState(defaultScope ?? scopePresets[0]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 浮动态默认收起：项目页的主角是文件，问答不该一进来就占半屏
  const [open, setOpen] = useState(dock === "inline");
  const scopeRef = useDismissableLayer<HTMLDivElement>(scopeOpen, () => setScopeOpen(false));

  useEffect(() => { setScope(defaultScope ?? scopePresets[0]); }, [defaultScope]);

  /* open 的初值来自 dock，但 dock 是会变的：从「全部项目」收窄到某个项目时，
     同一个组件实例从 inline 变成 floating，而 useState 只读一次初值——
     结果浮动态一直是展开的，那颗收起的胶囊永远不出现。 */
  useEffect(() => { setOpen(dock === "inline"); }, [dock]);

  const scopeOptions = [...scopePresets, ...projects.map((project) => project.name)];
  const scopedFiles = scope === "全部资料" ? files : files.filter((file) => file.project === scope);
  const latest = turns[turns.length - 1] ?? null;
  const earlier = turns.slice(0, -1);

  const ask = (question: string) => {
    const next = question.trim();
    if (!next) return;
    setTurns((current) => [...current, answerFor(next, scope, scopedFiles)]);
    setText("");
  };
  const submit = () => ask(text);

  if (dock === "floating" && !open) {
    return (
      <button className="knowledgeAskLauncher" type="button" onClick={() => setOpen(true)}>
        <Sparkles size={15} />
        <span>问问项目助手</span>
        <em>{scope}</em>
      </button>
    );
  }

  return (
    <section className={`knowledgeAsk dock-${dock}`} aria-label="资料问答">
      <div className="knowledgeAskBar">
        {/* 浮动态的首格是收起键，不是一颗绝对定位盖在右上角的叉。
            展开与收起共用同一颗胶囊，答案浮在它上方——同一个东西变大变小，
            而不是把胶囊塞进一张更大的卡里再套一层。 */}
        {dock === "floating" ? (
          <button className="knowledgeAskCollapse" type="button" onClick={() => setOpen(false)} aria-label="收起助手">
            <ChevronDown size={14} />
          </button>
        ) : (
          <Sparkles size={16} className="knowledgeAskSpark" />
        )}
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

      {/* 建议卡只在跨项目视角、且还没问过的时候出现。
          进了某个项目主角就是翻文件，那时候这几张卡是在抢文件表的首屏；
          问过一次之后用户已经知道这儿能问什么，再挂着就是占位置。
          三条各自命中不同的回答分支，不是三张一样的装饰。 */}
      {dock === "inline" && !turns.length ? (
        <div className="knowledgeAskSuggestions">
          {askSuggestions.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => ask(suggestion)}>
              <Sparkles size={13} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      ) : null}

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
