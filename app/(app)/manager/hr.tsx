/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Manager-owned HR control surface. These are the pieces hotcol keeps out of
// the HR desk: OTP resets, departments, workflows, leave/incident type
// catalogues, shift templates, checklist templates, the hiring desk and chat
// control. The operational HR screens stay in the /hr portal.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ClipboardCheck,
  Clock,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Network,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { hrApi, type HrDepartment } from "@/lib/api";
import { hrExt, type HrEmployeeFull, type HrShiftTemplate } from "@/lib/api/hr";
import { CHIP_TONES, ControlHero, EmptyState, type HrTone } from "../hr/ui";
import OtpResetSection from "../hr/otp";
import DepartmentsSection from "../hr/departments";
import WorkflowsSection from "../hr/workflows";
import { LeaveTypesSection } from "../hr/leave";
import { IncidentTypesSection } from "../hr/incidents";
import ShiftsSection from "../hr/shifts";
import { ChecklistTemplatesSection } from "../hr/checklists";
import { HiringSection } from "../hr/portals";
import ChatSection from "../hr/chat";

type SectionMeta = {
  tone: HrTone;
  icon: ReactNode;
  title: string;
  description: string;
};

const SECTION_META: Record<string, SectionMeta> = {
  "hr-otp": {
    tone: "amber",
    icon: <KeyRound className="size-5" />,
    title: "Portal OTP resets",
    description:
      "Issue a fresh one-time code for any employee. The code is shown once, so copy it before closing the dialog.",
  },
  "hr-departments": {
    tone: "violet",
    icon: <Network className="size-5" />,
    title: "Departments & teams",
    description:
      "Own the org tree the roster hangs from. Departments roll up headcount; teams and branches group the operating units.",
  },
  "hr-workflows": {
    tone: "sky",
    icon: <Workflow className="size-5" />,
    title: "Approval workflows",
    description:
      "Set the ordered approval chain per request type. Steps run top to bottom, with an optional team-leader gate first.",
  },
  "hr-leave-types": {
    tone: "emerald",
    icon: <CalendarDays className="size-5" />,
    title: "Leave types",
    description:
      "The catalogue behind the leave request form: paid flags, yearly quota and archive state for every leave kind.",
  },
  "hr-incident-types": {
    tone: "rose",
    icon: <ShieldAlert className="size-5" />,
    title: "Incident types",
    description:
      "The catalogue behind the incident register. Each type decides whether a salary deduction is the default.",
  },
  "hr-shifts": {
    tone: "sky",
    icon: <Clock className="size-5" />,
    title: "Shift templates",
    description:
      "Reusable weekday patterns stamped onto employee profiles and attendance. HR only views these on the roster.",
  },
  "hr-checklists": {
    tone: "emerald",
    icon: <ListChecks className="size-5" />,
    title: "Checklist templates",
    description:
      "Onboarding and exit templates copied item-by-item into each run. HR ticks the items; you own the source templates.",
  },
  "hr-ats": {
    tone: "violet",
    icon: <ClipboardCheck className="size-5" />,
    title: "Hiring desk",
    description:
      "Unlock volosync-ats and control which desk role may move candidates through the offer stages.",
  },
  "hr-chat": {
    tone: "sky",
    icon: <MessagesSquare className="size-5" />,
    title: "Chat control",
    description:
      "Open employee conversations and answer the same threads the portal reads. Direct threads and group rooms share one inbox.",
  },
};

export default function ManagerHrSection({ view }: { view: string }) {
  const [people, setPeople] = useState<HrEmployeeFull[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [shifts, setShifts] = useState<HrShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [peopleRows, departmentRows, shiftRows] = await Promise.all([
      hrExt.employees(""),
      hrApi.departments(),
      hrExt.shiftTemplates(),
    ]);
    setPeople(peopleRows.data);
    setDepartments(departmentRows.data);
    setShifts(shiftRows.data);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [load]);

  const meta = SECTION_META[view];
  if (!meta) return null;

  let content: ReactNode = null;

  if (view === "hr-departments") {
    content = <DepartmentsSection reload={load} />;
  } else if (loading) {
    content = (
      <EmptyState
        icon={<Clock className="size-4" />}
        title="Loading the control surface…"
        hint="Fetching the roster, departments and shift templates."
      />
    );
  } else {
    switch (view) {
      case "hr-otp":
        content = <OtpResetSection reload={load} />;
        break;
      case "hr-workflows":
        content = (
          <WorkflowsSection people={people} departments={departments} shifts={shifts} reload={load} />
        );
        break;
      case "hr-leave-types":
        content = <LeaveTypesSection reload={load} />;
        break;
      case "hr-incident-types":
        content = <IncidentTypesSection reload={load} />;
        break;
      case "hr-shifts":
        content = (
          <ShiftsSection people={people} departments={departments} shifts={shifts} reload={load} />
        );
        break;
      case "hr-checklists":
        content = <ChecklistTemplatesSection departments={departments} reload={load} />;
        break;
      case "hr-ats":
        content = <HiringSection people={people} reload={load} />;
        break;
      case "hr-chat":
        content = (
          <ChatSection people={people} departments={departments} shifts={shifts} reload={load} />
        );
        break;
      default:
        content = null;
    }
  }

  return (
    <>
      <ControlHero
        tone={meta.tone}
        icon={meta.icon}
        title={meta.title}
        description={meta.description}
        meta={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase ${CHIP_TONES[meta.tone]}`}
          >
            <ShieldCheck className="size-3" /> Manager only
          </span>
        }
      />
      {content}
    </>
  );
}
