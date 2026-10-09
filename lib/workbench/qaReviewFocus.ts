import type { Ticket } from "./ticketData";

export const QA_REVIEW_MODULE_ID = "qa-review";

export const qaReviewHomeFocus = {
  title: "要审核哪份文件？",
  body: "从站内信接手待审工单，或新建一份 QA 审核任务。审核过程会保留文件、批注、版本比对和审批结论。",
  quickStartLabel: "QA 审核入口",
};

export type QaTicketBrief = {
  title: string;
  description: string;
  checks: Array<{ label: string; value: string }>;
};

export function isQaReviewTicket(ticket: Pick<Ticket, "kind">) {
  return ticket.kind === QA_REVIEW_MODULE_ID;
}

export function qaTicketBrief(ticket: Ticket): QaTicketBrief {
  const fileCount = ticket.attachments.length;
  const lastStep = ticket.steps[ticket.steps.length - 1];
  return {
    title: "QA 审核包",
    description: "这张工单只负责把文件送进审核会话。具体批注、版本比对、通过或驳回，都在 QA 审核台完成。",
    checks: [
      { label: "待审文件", value: fileCount ? `${fileCount} 份随行产物` : "暂无随行产物" },
      { label: "当前处理人", value: `${ticket.assignee} · ${ticket.assigneeRole}` },
      { label: "最近流转", value: lastStep ? `${lastStep.action} · ${lastStep.at}` : ticket.updatedAt },
    ],
  };
}
