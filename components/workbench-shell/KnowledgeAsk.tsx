"use client";

import { ArrowLeft, ArrowUp, BookmarkPlus, Check, ChevronDown, FileText, History, Maximize2, Quote, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
export function KnowledgeAsk({ projects, files, onOpenFile, dock = "inline", defaultScope, onSaveAnswer }: { projects: WorkbenchProject[]; files: KnowledgeFile[]; onOpenFile: (file: KnowledgeFile) => void; dock?: "inline" | "floating"; defaultScope?: string; onSaveAnswer?: (title: string, body: string) => void }) {
  /* 存过哪几条要记住：按钮变成「已存到产物」，否则用户不确定刚才那下有没有生效，
     就会再点一次，产物里躺着两份一模一样的东西。 */
  const [savedTurnIds, setSavedTurnIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [scope, setScope] = useState(defaultScope ?? scopePresets[0]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* 两种停靠都从收起的胶囊开始。
     此前只有浮动态收起、跨项目态常驻展开，于是同一个问答在两屏是两副样子：
     一屏是一条占着首屏的输入条，另一屏是一颗要点开的胶囊。
     统一成"点一下才展开"之后，文件表在两屏都能立刻看到。 */
  const [open, setOpen] = useState(false);
  /* 放大：不是把胶囊拉宽，而是换成一个次级界面——铺满面包屑以下、
     侧边栏以右的整块区域，像一个临时开出来的会话窗。
     它**不进侧边栏**：这是一次性的问答，关掉就结束，不留任务。 */
  const [full, setFull] = useState(false);
  /* 吸底那条和全屏窗里那条是两个 DOM 节点，各自要一个 ref。
     共用一个的话，没挂上 ref 的那条在 useDismissableLayer 里
     `ref.current?.contains(...)` 得到 undefined，取反成真 —— 点开的那一下
     自己就把自己关了，范围下拉在全屏窗里根本打不开。 */
  const scopeRef = useDismissableLayer<HTMLDivElement>(scopeOpen, () => setScopeOpen(false));
  const windowScopeRef = useDismissableLayer<HTMLDivElement>(scopeOpen, () => setScopeOpen(false));
  const rootRef = useRef<HTMLElement | null>(null);
  /* 全屏窗要挂到工作区上，而不是留在文件表里——文件表自己是滚动容器，
     浮在它内部的东西会跟着列表一起滚走，也盖不住顶栏以下的整块区域。 */
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => { setScope(defaultScope ?? scopePresets[0]); }, [defaultScope]);

  /* dock 会变：从「全部项目」收窄到某个项目时同一个实例换停靠。
     换停靠时收回胶囊，避免上一屏展开着的面板跟着漂到新位置。 */
  useEffect(() => { setOpen(false); setFull(false); }, [dock]);

  useEffect(() => {
    setHost(rootRef.current?.closest<HTMLElement>(".dmpkWorkspace, .workspace") ?? null);
  }, [open]);

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

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

  /* 输入条在吸底和全屏两处是同一段结构，抽出来渲染，避免两份各自漂移 */
  const askBar = (inWindow: boolean) => (
    <div className="knowledgeAskBar">
      {/* 首格是收起键，不是一颗绝对定位盖在右上角的叉。
          展开与收起共用同一颗胶囊——同一个东西变大变小，
          而不是把胶囊塞进一张更大的卡里再套一层。
          收起时一并退出全屏，否则下次点开直接是全屏，
          而用户以为自己点开的是那颗小胶囊。
          全屏窗里收起键让位给窗头那颗，一个动作只留一个门。 */}
      {inWindow ? null : (
        <button className="knowledgeAskCollapse" type="button" onClick={() => { setOpen(false); setFull(false); }} aria-label="收起助手">
          <ChevronDown size={14} />
        </button>
      )}
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
        placeholder="问一个问题，比如「血浆样本保存条件是什么」"
        aria-label="向资料提问"
      />
      {/* 范围选择器就是那个"电子围栏"：圈定在哪批资料里回答 */}
      <div ref={inWindow ? windowScopeRef : scopeRef} className="knowledgeAskScope">
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
      {/* 放大只在问过之后才有意义——没有答案时铺开的是一整屏空框 */}
      {turns.length && !inWindow ? (
        <button
          className="knowledgeAskFull"
          type="button"
          onClick={() => setFull(true)}
          aria-label="铺开为临时问答窗"
          title="铺开为临时问答窗"
        >
          <Maximize2 size={14} />
        </button>
      ) : null}
      <button className="knowledgeAskSend" type="button" disabled={!text.trim()} onClick={submit} aria-label="提问">
        <ArrowUp size={15} />
      </button>
    </div>
  );

  /* 收起态：两种停靠共用同一颗胶囊 */
  if (!open) {
    return (
      <button
        ref={(node) => { rootRef.current = node; }}
        className={`knowledgeAskLauncher dock-${dock}`}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={15} />
        <span>{dock === "floating" ? "问问项目助手" : "问问资料助手"}</span>
        <em>{scope}</em>
      </button>
    );
  }

  return (
    <section
      ref={(node) => { rootRef.current = node; }}
      className={`knowledgeAsk dock-${dock} ${full ? "isFull" : ""}`}
      aria-label="资料问答"
    >
      {askBar(false)}

      {/* 建议卡跟着展开一起出现，两种停靠一视同仁。
          此前它被 dock === "inline" 挡着，于是项目里点开胶囊只有一个空输入框，
          用户不知道这儿能问什么。既然默认是收起的，就不存在"抢文件表首屏"了。
          问过一次之后不再显示——那时用户已经知道能问什么。
          三条各自命中不同的回答分支，不是三张一样的装饰。 */}
      {!turns.length ? (
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
        <AskAnswer
          turn={latest}
          files={files}
          onOpenFile={onOpenFile}
          onSave={onSaveAnswer}
          saved={savedTurnIds.includes(latest.id)}
          onSaved={() => setSavedTurnIds((current) => [...current, latest.id])}
        />
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

      {/* 铺开的临时问答窗。挂在工作区上、只盖住面包屑以下那一格，
          于是面包屑和左侧任务栏始终留着——用户随时看得到自己在哪，
          也随时能一步走开。这一屏没有对应的任务，关掉就没了。 */}
      {full && host
        ? createPortal(
            <section className="knowledgeAskWindow" role="dialog" aria-label="资料问答 · 临时会话">
              {/* 窗头只留一个出口。原来这条压在面包屑下面，于是顶上叠了两条头：
                  一条讲"你在数据中枢的哪儿"，一条讲"你在问答里"——而这一刻
                  前者已经不成立了，人根本不在文件表上。所以整块盖掉，
                  只留一颗返回键。范围和"临时会话"这两句话跟着 composer 走，
                  它们是提问时才用得上的信息，不该常驻在顶上。 */}
              <header className="knowledgeAskWindowBar">
                <button
                  className="knowledgeAskWindowBack"
                  type="button"
                  onClick={() => setFull(false)}
                  aria-label="返回数据中枢（Esc）"
                  title="返回数据中枢（Esc）"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="knowledgeAskWindowTitle"><Sparkles size={15} />资料问答</span>
                <span className="knowledgeAskWindowNote">临时会话，不会存进左侧任务</span>
              </header>

              <div className="knowledgeAskWindowScroll">
                <div className="knowledgeAskThread">
                  {turns.map((turn) => (
                    <AskAnswer
                      key={turn.id}
                      turn={turn}
                      files={files}
                      onOpenFile={onOpenFile}
                      onSave={onSaveAnswer}
                      saved={savedTurnIds.includes(turn.id)}
                      onSaved={() => setSavedTurnIds((current) => [...current, turn.id])}
                    />
                  ))}
                </div>
              </div>

              <footer className="knowledgeAskWindowComposer">{askBar(true)}</footer>
            </section>,
            host,
          )
        : null}
    </section>
  );
}

/** 一问一答：问题在上、答案在下、出处跟着答案走。吸底和全屏共用这一份。 */
function AskAnswer({ turn, files, onOpenFile, onSave, saved, onSaved }: { turn: AskTurn; files: KnowledgeFile[]; onOpenFile: (file: KnowledgeFile) => void; onSave?: (title: string, body: string) => void; saved?: boolean; onSaved?: () => void }) {
  return (
    <article className="knowledgeAnswer">
      <p className="knowledgeAnswerQuestion">{turn.question}</p>
      <p className="knowledgeAnswerBody">{turn.answer}</p>

      {/* 出处不是装饰，是这个答案能不能用的前提 */}
      <div className="knowledgeAnswerCitations">
        <span className="knowledgeCitationLabel"><Quote size={11} />出处</span>
        {turn.citations.map((citation) => {
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

      {turn.handoff ? (
        <p className="knowledgeAnswerHandoff">
          要出正式产物得走任务流程 —— 要我叫 <strong>{turn.handoff}</strong> 接手吗？
          <button type="button">交给它</button>
        </p>
      ) : null}

      {/* 轻量保存：资料空间不是任务驱动的，这里问出来的答案没有任务去承接它，
          存下来才不会问完就散。存的是这个空间自己的沉淀，不走审批轨迹。 */}
      {onSave ? (
        <button
          className={`knowledgeAnswerSave ${saved ? "isSaved" : ""}`}
          type="button"
          disabled={saved}
          onClick={() => { onSave(turn.question, turn.answer); onSaved?.(); }}
        >
          {saved ? <><Check size={12} />已存到产物</> : <><BookmarkPlus size={12} />存到产物</>}
        </button>
      ) : null}
    </article>
  );
}
