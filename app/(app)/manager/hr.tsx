"use client";

// Manager HR control surface. Every entry renders the same workspace panel the
// HR role uses — the Manager portal is the HR module read with Manager
// capabilities, not a second implementation of it.

import { HrAtsOtpPanel } from "@/components/hr/HrAtsOtpPanel";
import { HrChatControlPanel } from "@/components/hr/HrChatControlPanel";
import { HrDashboard, type HrSection } from "@/components/hr/HrDashboard";

const VIEW_TO_SECTION: Record<string, HrSection> = {
  hr: "dashboard",
  "hr-approvals": "manager-pending",
  "hr-termination": "approvals-terminate",
  "hr-attendance": "approvals-attendance",
  "hr-payroll": "approvals-payroll",
  "hr-otp": "otp-reset",
  "hr-workflows": "workflows",
  "hr-leave-types": "leave",
  "hr-attendance-report": "attendance",
  "hr-incident-types": "incidents",
  "hr-departments": "departments",
  "hr-documents": "documents",
  "hr-shifts": "shift-templates",
  "hr-checklists": "checklists",
  "hr-compensation": "compensation",
  "hr-people-ops": "people-ops",
  "hr-payroll-runs": "payroll-runs",
  "hr-payroll-settings": "payroll-settings",
  "hr-payroll-history": "payroll-history",
};

export default function ManagerHrSection({ view }: { view: string }) {
  if (view === "hr-chat") return <HrChatControlPanel />;
  if (view === "hr-ats-otp") return <HrAtsOtpPanel />;

  const section = VIEW_TO_SECTION[view];
  if (!section) return null;
  return <HrDashboard embedded section={section} />;
}
