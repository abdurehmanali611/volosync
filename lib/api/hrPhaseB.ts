import { gql } from "@/lib/api/hrDjango";


export type HrShiftTemplate = {
  id: number;
  HotelName: string;
  code: string;
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  weekdayJson: string;
  notes: string;
  active: boolean;
};

export type HrChecklistTemplateItem = {
  id: number;
  label: string;
  required: boolean;
  defaultOwner: string;
  sortOrder: number;
};

export type HrChecklistTemplate = {
  id: number;
  HotelName: string;
  kind: string;
  name: string;
  active: boolean;
  required: boolean;
  department: string;
  jobTitle: string;
  teamId: number | null;
  items: HrChecklistTemplateItem[];
};

export type HrChecklistRunItem = {
  id: number;
  label: string;
  required: boolean;
  ownerRole: string;
  done: boolean;
  completedBy: string;
  completedAt: string | null;
  note: string;
  sortOrder: number;
};

export type HrChecklistRun = {
  id: number;
  HotelName: string;
  templateId: number;
  employeeId: number;
  kind: string;
  status: string;
  items: HrChecklistRunItem[];
  createdAt: string;
};

export type HrSalaryHistory = {
  id: number;
  employeeId: number;
  previousETB: number;
  newETB: number;
  reason: string;
  status: string;
  changedBy: string;
  decidedBy: string;
  createdAt: string;
};

export type HrAdvanceRequest = {
  id: number;
  employeeId: number;
  amountETB: number;
  reason: string;
  status: string;
  requestedBy: string;
  createdAt: string;
};

export type HrLoan = {
  id: number;
  employeeId: number;
  principalETB: number;
  remainingETB: number;
  installmentETB: number;
  reason: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrBonus = {
  id: number;
  employeeId: number;
  label: string;
  amountETB: number;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrOvertimeRequest = {
  id: number;
  employeeId: number;
  workYmd: string;
  hours: number;
  amountETB: number;
  reason: string;
  status: string;
  requestedBy: string;
  createdAt: string;
};

export type HrCareerAction = {
  id: number;
  employeeId: number;
  kind: string;
  detail: string;
  fromDept: string;
  toDept: string;
  fromTitle: string;
  toTitle: string;
  /** Target team applied on Manager approve; null keeps the current team. */
  toTeamId: number | null;
  toOrgPosition: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrDisciplinaryAction = {
  id: number;
  employeeId: number;
  title: string;
  detail: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrPerformanceReview = {
  id: number;
  employeeId: number;
  periodLabel: string;
  rating: string;
  summary: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrTrainingAssignment = {
  id: number;
  employeeId: number;
  title: string;
  detail: string;
  dueYmd: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrBenefitAssignment = {
  id: number;
  employeeId: number;
  kind: string;
  label: string;
  amountETB: number;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type HrAsset = {
  id: number;
  employeeId: number | null;
  label: string;
  serialNo: string;
  status: string;
  issuedYmd: string;
  returnedYmd: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export async function fetchHrShiftTemplates(): Promise<HrShiftTemplate[]> {
  const data = await gql<{ hrShiftTemplates: HrShiftTemplate[] }>(
    `query {
      hrShiftTemplates {
        id HotelName code name department startTime endTime weekdayJson notes active
      }
    }`,
  );
  return data.hrShiftTemplates ?? [];
}

export async function upsertHrShiftTemplateApi(input: {
  id?: number;
  code: string;
  name: string;
  department?: string;
  startTime?: string;
  endTime?: string;
  weekdayJson?: string;
  notes?: string;
  active?: boolean;
}): Promise<HrShiftTemplate> {
  const data = await gql<{ upsertHrShiftTemplate: HrShiftTemplate }>(
    `mutation ($input: HrShiftTemplateInput!) {
      upsertHrShiftTemplate(input: $input) {
        id code name department startTime endTime weekdayJson notes active
      }
    }`,
    { input },
  );
  return data.upsertHrShiftTemplate;
}

export async function deleteHrShiftTemplateApi(id: number): Promise<boolean> {
  const data = await gql<{ deleteHrShiftTemplate: boolean }>(
    `mutation ($id: Int!) { deleteHrShiftTemplate(id: $id) }`,
    { id },
  );
  return Boolean(data.deleteHrShiftTemplate);
}

export async function applyHrShiftTemplateApi(input: {
  templateId: number;
  employeeIds: number[];
  fromYmd: string;
  toYmd: string;
}): Promise<number> {
  const data = await gql<{ applyHrShiftTemplate: number }>(
    `mutation ($templateId: Int!, $employeeIds: [Int!]!, $fromYmd: String!, $toYmd: String!) {
      applyHrShiftTemplate(
        templateId: $templateId
        employeeIds: $employeeIds
        fromYmd: $fromYmd
        toYmd: $toYmd
      )
    }`,
    input,
  );
  return data.applyHrShiftTemplate;
}

export async function fetchHrChecklistTemplates(
  kind?: string,
): Promise<HrChecklistTemplate[]> {
  const data = await gql<{ hrChecklistTemplates: HrChecklistTemplate[] }>(
    `query ($kind: String) {
      hrChecklistTemplates(kind: $kind) {
        id HotelName kind name active required department jobTitle teamId
        items { id label required defaultOwner sortOrder }
      }
    }`,
    { kind: kind || null },
  );
  return data.hrChecklistTemplates ?? [];
}

export async function saveHrChecklistTemplateApi(input: {
  id?: number;
  kind: string;
  name: string;
  active?: boolean;
  required?: boolean;
  department?: string;
  jobTitle?: string;
  teamId?: number | null;
  items: Array<{
    label: string;
    required?: boolean;
    defaultOwner?: string;
    sortOrder?: number;
  }>;
}): Promise<HrChecklistTemplate> {
  const data = await gql<{ saveHrChecklistTemplate: HrChecklistTemplate }>(
    `mutation (
      $id: Int
      $kind: String!
      $name: String!
      $active: Boolean
      $required: Boolean
      $department: String
      $jobTitle: String
      $teamId: Int
      $items: [HrChecklistTemplateItemInput!]!
    ) {
      saveHrChecklistTemplate(
        id: $id
        kind: $kind
        name: $name
        active: $active
        required: $required
        department: $department
        jobTitle: $jobTitle
        teamId: $teamId
        items: $items
      ) {
        id kind name active required department jobTitle teamId
        items { id label required defaultOwner sortOrder }
      }
    }`,
    {
      ...input,
      teamId: input.teamId == null || input.teamId <= 0 ? null : input.teamId,
    },
  );
  return data.saveHrChecklistTemplate;
}

export async function deleteHrChecklistTemplateApi(id: number): Promise<boolean> {
  const data = await gql<{ deleteHrChecklistTemplate: boolean }>(
    `mutation ($id: Int!) {
      deleteHrChecklistTemplate(id: $id)
    }`,
    { id },
  );
  return Boolean(data.deleteHrChecklistTemplate);
}

export async function fetchHrChecklistRuns(input?: {
  employeeId?: number;
  kind?: string;
}): Promise<HrChecklistRun[]> {
  const data = await gql<{ hrChecklistRuns: HrChecklistRun[] }>(
    `query ($employeeId: Int, $kind: String) {
      hrChecklistRuns(employeeId: $employeeId, kind: $kind) {
        id HotelName templateId employeeId kind status createdAt
        items {
          id label required ownerRole done completedBy completedAt note sortOrder
        }
      }
    }`,
    { employeeId: input?.employeeId ?? null, kind: input?.kind ?? null },
  );
  return data.hrChecklistRuns ?? [];
}

export async function startHrChecklistRunApi(
  employeeId: number,
  kind: string,
): Promise<HrChecklistRun> {
  const data = await gql<{ startHrChecklistRun: HrChecklistRun }>(
    `mutation ($employeeId: Int!, $kind: String!) {
      startHrChecklistRun(employeeId: $employeeId, kind: $kind) {
        id employeeId kind status
        items { id label required done }
      }
    }`,
    { employeeId, kind },
  );
  return data.startHrChecklistRun;
}

export async function toggleHrChecklistRunItemApi(input: {
  id: number;
  done: boolean;
  note?: string;
}) {
  const data = await gql<{ toggleHrChecklistRunItem: HrChecklistRunItem }>(
    `mutation ($id: Int!, $done: Boolean!, $note: String) {
      toggleHrChecklistRunItem(id: $id, done: $done, note: $note) {
        id done completedBy completedAt note
      }
    }`,
    input,
  );
  return data.toggleHrChecklistRunItem;
}

export async function completeHrChecklistRunApi(id: number) {
  const data = await gql<{ completeHrChecklistRun: HrChecklistRun }>(
    `mutation ($id: Int!) {
      completeHrChecklistRun(id: $id) { id status }
    }`,
    { id },
  );
  return data.completeHrChecklistRun;
}

export async function approveHrChecklistRunApi(id: number, approve: boolean) {
  const data = await gql<{ approveHrChecklistRun: HrChecklistRun }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      approveHrChecklistRun(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.approveHrChecklistRun;
}

export async function fetchHrSalaryHistory(employeeId?: number) {
  const data = await gql<{ hrSalaryHistory: HrSalaryHistory[] }>(
    `query ($employeeId: Int) {
      hrSalaryHistory(employeeId: $employeeId) {
        id employeeId previousETB newETB reason status changedBy decidedBy createdAt
      }
    }`,
    { employeeId: employeeId ?? null },
  );
  return data.hrSalaryHistory ?? [];
}

export async function requestHrSalaryChangeApi(input: {
  employeeId: number;
  newETB: number;
  reason?: string;
}) {
  const data = await gql<{ requestHrSalaryChange: HrSalaryHistory }>(
    `mutation ($employeeId: Int!, $newETB: Float!, $reason: String) {
      requestHrSalaryChange(employeeId: $employeeId, newETB: $newETB, reason: $reason) {
        id status previousETB newETB
      }
    }`,
    input,
  );
  return data.requestHrSalaryChange;
}

export async function decideHrSalaryChangeApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrSalaryChange: HrSalaryHistory }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrSalaryChange(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrSalaryChange;
}

export async function fetchHrAdvanceRequests(status?: string) {
  const data = await gql<{ hrAdvanceRequests: HrAdvanceRequest[] }>(
    `query ($status: String) {
      hrAdvanceRequests(status: $status) {
        id employeeId amountETB reason status requestedBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrAdvanceRequests ?? [];
}

export async function createHrAdvanceRequestApi(input: {
  employeeId: number;
  amountETB: number;
  reason?: string;
}) {
  const data = await gql<{ createHrAdvanceRequest: HrAdvanceRequest }>(
    `mutation ($employeeId: Int!, $amountETB: Float!, $reason: String) {
      createHrAdvanceRequest(employeeId: $employeeId, amountETB: $amountETB, reason: $reason) {
        id status amountETB
      }
    }`,
    input,
  );
  return data.createHrAdvanceRequest;
}

export async function decideHrAdvanceRequestApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrAdvanceRequest: HrAdvanceRequest }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrAdvanceRequest(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrAdvanceRequest;
}

export async function fetchHrLoans(status?: string) {
  const data = await gql<{ hrLoans: HrLoan[] }>(
    `query ($status: String) {
      hrLoans(status: $status) {
        id employeeId principalETB remainingETB installmentETB reason status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrLoans ?? [];
}

export async function createHrLoanApi(input: {
  employeeId: number;
  principalETB: number;
  installmentETB?: number;
  reason?: string;
}) {
  const data = await gql<{ createHrLoan: HrLoan }>(
    `mutation ($employeeId: Int!, $principalETB: Float!, $installmentETB: Float, $reason: String) {
      createHrLoan(
        employeeId: $employeeId
        principalETB: $principalETB
        installmentETB: $installmentETB
        reason: $reason
      ) { id status }
    }`,
    input,
  );
  return data.createHrLoan;
}

export async function decideHrLoanApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrLoan: HrLoan }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrLoan(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrLoan;
}

export async function fetchHrBonuses(status?: string) {
  const data = await gql<{ hrBonuses: HrBonus[] }>(
    `query ($status: String) {
      hrBonuses(status: $status) {
        id employeeId label amountETB status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrBonuses ?? [];
}

export async function createHrBonusApi(input: {
  employeeId: number;
  label: string;
  amountETB: number;
}) {
  const data = await gql<{ createHrBonus: HrBonus }>(
    `mutation ($employeeId: Int!, $label: String!, $amountETB: Float!) {
      createHrBonus(employeeId: $employeeId, label: $label, amountETB: $amountETB) {
        id status
      }
    }`,
    input,
  );
  return data.createHrBonus;
}

export async function decideHrBonusApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrBonus: HrBonus }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrBonus(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrBonus;
}

export async function fetchHrOvertimeRequests(status?: string) {
  const data = await gql<{ hrOvertimeRequests: HrOvertimeRequest[] }>(
    `query ($status: String) {
      hrOvertimeRequests(status: $status) {
        id employeeId workYmd hours amountETB reason status requestedBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrOvertimeRequests ?? [];
}

export async function createHrOvertimeRequestApi(input: {
  employeeId: number;
  workYmd: string;
  hours: number;
  amountETB?: number;
  reason?: string;
}) {
  const data = await gql<{ createHrOvertimeRequest: HrOvertimeRequest }>(
    `mutation (
      $employeeId: Int!
      $workYmd: String!
      $hours: Float!
      $amountETB: Float
      $reason: String
    ) {
      createHrOvertimeRequest(
        employeeId: $employeeId
        workYmd: $workYmd
        hours: $hours
        amountETB: $amountETB
        reason: $reason
      ) { id status }
    }`,
    input,
  );
  return data.createHrOvertimeRequest;
}

export async function decideHrOvertimeRequestApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrOvertimeRequest: HrOvertimeRequest }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrOvertimeRequest(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrOvertimeRequest;
}

export async function fetchHrCareerActions(status?: string) {
  const data = await gql<{ hrCareerActions: HrCareerAction[] }>(
    `query ($status: String) {
      hrCareerActions(status: $status) {
        id employeeId kind detail fromDept toDept fromTitle toTitle toTeamId toOrgPosition status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrCareerActions ?? [];
}

export async function createHrCareerActionApi(input: {
  employeeId: number;
  kind: string;
  detail?: string;
  fromDept?: string;
  toDept?: string;
  fromTitle?: string;
  toTitle?: string;
  toTeamId?: number | null;
  toOrgPosition?: string;
}) {
  const data = await gql<{ createHrCareerAction: HrCareerAction }>(
    `mutation (
      $employeeId: Int!
      $kind: String!
      $detail: String
      $fromDept: String
      $toDept: String
      $fromTitle: String
      $toTitle: String
      $toTeamId: Int
      $toOrgPosition: String
    ) {
      createHrCareerAction(
        employeeId: $employeeId
        kind: $kind
        detail: $detail
        fromDept: $fromDept
        toDept: $toDept
        fromTitle: $fromTitle
        toTitle: $toTitle
        toTeamId: $toTeamId
        toOrgPosition: $toOrgPosition
      ) { id status }
    }`,
    { ...input, toTeamId: input.toTeamId ?? null },
  );
  return data.createHrCareerAction;
}

export async function decideHrCareerActionApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrCareerAction: HrCareerAction }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrCareerAction(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrCareerAction;
}

export async function fetchHrDisciplinaryActions(status?: string) {
  const data = await gql<{ hrDisciplinaryActions: HrDisciplinaryAction[] }>(
    `query ($status: String) {
      hrDisciplinaryActions(status: $status) {
        id employeeId title detail status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrDisciplinaryActions ?? [];
}

export async function createHrDisciplinaryActionApi(input: {
  employeeId: number;
  title: string;
  detail?: string;
}) {
  const data = await gql<{ createHrDisciplinaryAction: HrDisciplinaryAction }>(
    `mutation ($employeeId: Int!, $title: String!, $detail: String) {
      createHrDisciplinaryAction(employeeId: $employeeId, title: $title, detail: $detail) {
        id status
      }
    }`,
    input,
  );
  return data.createHrDisciplinaryAction;
}

export async function decideHrDisciplinaryActionApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrDisciplinaryAction: HrDisciplinaryAction }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrDisciplinaryAction(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrDisciplinaryAction;
}

export async function fetchHrPerformanceReviews(status?: string) {
  const data = await gql<{ hrPerformanceReviews: HrPerformanceReview[] }>(
    `query ($status: String) {
      hrPerformanceReviews(status: $status) {
        id employeeId periodLabel rating summary status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrPerformanceReviews ?? [];
}

export async function createHrPerformanceReviewApi(input: {
  employeeId: number;
  periodLabel?: string;
  rating?: string;
  summary?: string;
}) {
  const data = await gql<{ createHrPerformanceReview: HrPerformanceReview }>(
    `mutation ($employeeId: Int!, $periodLabel: String, $rating: String, $summary: String) {
      createHrPerformanceReview(
        employeeId: $employeeId
        periodLabel: $periodLabel
        rating: $rating
        summary: $summary
      ) { id status }
    }`,
    input,
  );
  return data.createHrPerformanceReview;
}

export async function finalizeHrPerformanceReviewApi(id: number, approve: boolean) {
  const data = await gql<{ finalizeHrPerformanceReview: HrPerformanceReview }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      finalizeHrPerformanceReview(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.finalizeHrPerformanceReview;
}

export async function fetchHrTrainingAssignments(status?: string) {
  const data = await gql<{ hrTrainingAssignments: HrTrainingAssignment[] }>(
    `query ($status: String) {
      hrTrainingAssignments(status: $status) {
        id employeeId title detail dueYmd status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrTrainingAssignments ?? [];
}

export async function createHrTrainingAssignmentApi(input: {
  employeeId: number;
  title: string;
  detail?: string;
  dueYmd?: string;
}) {
  const data = await gql<{ createHrTrainingAssignment: HrTrainingAssignment }>(
    `mutation ($employeeId: Int!, $title: String!, $detail: String, $dueYmd: String) {
      createHrTrainingAssignment(
        employeeId: $employeeId
        title: $title
        detail: $detail
        dueYmd: $dueYmd
      ) { id status }
    }`,
    input,
  );
  return data.createHrTrainingAssignment;
}

export async function decideHrTrainingAssignmentApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrTrainingAssignment: HrTrainingAssignment }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrTrainingAssignment(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrTrainingAssignment;
}

export async function fetchHrBenefitAssignments(status?: string) {
  const data = await gql<{ hrBenefitAssignments: HrBenefitAssignment[] }>(
    `query ($status: String) {
      hrBenefitAssignments(status: $status) {
        id employeeId kind label amountETB status createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrBenefitAssignments ?? [];
}

export async function createHrBenefitAssignmentApi(input: {
  employeeId: number;
  kind: string;
  label: string;
  amountETB?: number;
}) {
  const data = await gql<{ createHrBenefitAssignment: HrBenefitAssignment }>(
    `mutation ($employeeId: Int!, $kind: String!, $label: String!, $amountETB: Float) {
      createHrBenefitAssignment(
        employeeId: $employeeId
        kind: $kind
        label: $label
        amountETB: $amountETB
      ) { id status }
    }`,
    input,
  );
  return data.createHrBenefitAssignment;
}

export async function decideHrBenefitAssignmentApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrBenefitAssignment: HrBenefitAssignment }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrBenefitAssignment(id: $id, approve: $approve) { id status }
    }`,
    { id, approve },
  );
  return data.decideHrBenefitAssignment;
}

export async function fetchHrAssets(status?: string) {
  const data = await gql<{ hrAssets: HrAsset[] }>(
    `query ($status: String) {
      hrAssets(status: $status) {
        id employeeId label serialNo status issuedYmd returnedYmd notes createdBy createdAt
      }
    }`,
    { status: status ?? null },
  );
  return data.hrAssets ?? [];
}

export async function createHrAssetApi(input: {
  label: string;
  serialNo?: string;
  notes?: string;
}) {
  const data = await gql<{ createHrAsset: HrAsset }>(
    `mutation ($label: String!, $serialNo: String, $notes: String) {
      createHrAsset(label: $label, serialNo: $serialNo, notes: $notes) {
        id status label
      }
    }`,
    input,
  );
  return data.createHrAsset;
}

export async function issueHrAssetApi(input: {
  id: number;
  employeeId: number;
  issuedYmd: string;
}) {
  const data = await gql<{ issueHrAsset: HrAsset }>(
    `mutation ($id: Int!, $employeeId: Int!, $issuedYmd: String!) {
      issueHrAsset(id: $id, employeeId: $employeeId, issuedYmd: $issuedYmd) {
        id status employeeId
      }
    }`,
    input,
  );
  return data.issueHrAsset;
}

export async function returnHrAssetApi(input: { id: number; returnedYmd: string }) {
  const data = await gql<{ returnHrAsset: HrAsset }>(
    `mutation ($id: Int!, $returnedYmd: String!) {
      returnHrAsset(id: $id, returnedYmd: $returnedYmd) { id status }
    }`,
    input,
  );
  return data.returnHrAsset;
}
