"use client";

import { Download, X } from "lucide-react";
import { useModalDismiss } from "../ui/useModalDismiss";
import { QuoteDocPaper, QuoteSheetPaper, money, quoteCategories } from "./QuotePaper";
import { quoteItems, quoteMeta, quoteParams, quoteSubtotals } from "../../lib/workbench/quoteData";
import type { MailResourceRef } from "../../lib/workbench/mailboxData";
import type { Ticket } from "../../lib/workbench/ticketData";

/* 随单产物的预览与下载。
   -------------------------------------------------------------------
   预览渲染的是审核画布里的同一份纸面(QuotePaper),不是另画一版占位——否则
   预览里看到的和点进去审的不是同一张纸,预览就没有意义了。

   只有原型确实持有内容的文件才给这两个动作。其余附件(压缩包、别人的 PDF)在
   原型里没有字节,与其摆两个点了没反应的按钮,不如不摆:一个高保真原型里,
   按钮存在就是在承诺一件事做得到。 */

export type TicketFileView = "quote-doc" | "quote-sheet";

/** 这份附件在原型里有没有可渲染的内容。没有就返回 null,调用方据此决定给不给动作。 */
export function ticketFileView(ticket: Ticket, file: MailResourceRef): TicketFileView | null {
  if (ticket.kind !== "dmpk-quotation") return null;
  if (file.name.endsWith(".xlsx")) return "quote-sheet";
  if (file.name.endsWith(".docx")) return "quote-doc";
  return null;
}

/* 下载给的是原型手里真有的那份数据,导成 CSV。
   不伪造 .xlsx/.docx 的字节:那需要一个真的写文件库,而拿一个改了扩展名的
   文本文件冒充,只会在客户双击打开报错的那一刻穿帮。文件名照实写 .csv。 */
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const csvRows = (view: TicketFileView) => {
  if (view === "quote-doc") {
    return [
      ["Category", "Item", "Description"],
      ...quoteCategories.flatMap((category) =>
        quoteItems.filter((item) => item.category === category).map((item) => [category, item.item, item.description])),
      [`Package Price (${quoteMeta.currency})`, "", money(quoteMeta.packagePrice)],
      [`Total Price (${quoteMeta.currency})`, "", money(quoteMeta.totalPrice)],
    ];
  }
  return [
    ["Category", "Item", "Description", "Unit Price"],
    ...quoteCategories.flatMap((category) =>
      quoteItems.filter((item) => item.category === category)
        .map((item) => [category, item.item, item.description, item.unitPrice === undefined ? "" : money(item.unitPrice)])),
    [],
    ["可编辑参数", "取值"],
    ...quoteParams.map((param) => [param.label, param.value]),
    [],
    ["小计", "金额"],
    ...quoteSubtotals.map((sub) => [sub.label, money(sub.amount)]),
    ["Standard Price", money(quoteMeta.standardPrice)],
    ["Discounted Price", money(quoteMeta.discountedPrice)],
  ];
};

export function downloadTicketFile(file: MailResourceRef, view: TicketFileView) {
  const body = csvRows(view).map((row) => row.map(csvCell).join(",")).join("\r\n");
  /* BOM:没有它 Excel 会把 UTF-8 的中文读成乱码。 */
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file.name.replace(/\.[^.]+$/, "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TicketFilePreview({ file, view, onClose }: {
  file: MailResourceRef;
  view: TicketFileView;
  onClose: () => void;
}) {
  /* 叉号、Esc、点遮罩三条路都能关,跟这套界面里其他弹窗一致。 */
  const dismiss = useModalDismiss(onClose);

  return (
    <div className="modalBackdrop" role="presentation" {...dismiss}>
      <section className="bioazUiDialog ticketFilePreview" role="dialog" aria-modal="true" aria-label={`预览 ${file.name}`}>
        <header className="bioazUiDialogHeader">
          <div>
            <h2>{file.name}</h2>
            <p>{file.meta}</p>
          </div>
          <button className="bioazUiDialogClose" type="button" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        <div className="bioazUiDialogBody ticketFilePreviewBody">
          {view === "quote-sheet" ? <QuoteSheetPaper /> : <QuoteDocPaper />}
        </div>

        <footer className="bioazUiDialogFooter">
          <button className="secondaryButton compact" type="button" onClick={() => downloadTicketFile(file, view)}>
            <Download size={14} />下载
          </button>
          <button className="primaryButton compact" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>
  );
}
