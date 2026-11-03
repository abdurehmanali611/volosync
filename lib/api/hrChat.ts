import { gql } from "@/lib/api/hrDjango";


const THREAD_FIELDS = `
  id HotelName kind title createdByEmployeeId createdByManagerUserId
  createdAt updatedAt messageCount
  lastMessage { id body imageUrl createdAt senderIsManager senderName }
  members {
    id threadId employeeId isManager memberKey joinedAt lastReadAt employeeName
  }
`;

export type HrChatMember = {
  id: number;
  threadId: number;
  employeeId: number | null;
  isManager: boolean;
  memberKey: string;
  joinedAt: string;
  lastReadAt: string | null;
  employeeName: string | null;
};

export type HrChatMessage = {
  id: number;
  threadId: number;
  senderEmployeeId: number | null;
  senderIsManager: boolean;
  body: string;
  imageUrl?: string;
  createdAt: string;
  senderName: string;
};

export type HrChatThread = {
  id: number;
  HotelName: string;
  kind: string;
  title: string;
  createdByEmployeeId: number | null;
  createdByManagerUserId: number | null;
  createdAt: string;
  updatedAt: string;
  members: HrChatMember[];
  lastMessage: HrChatMessage | null;
  messageCount: number | null;
};

export type HrChatBlock = {
  id: number;
  HotelName: string;
  pathType: string;
  employeeIdA: number;
  employeeIdB: number | null;
  note: string;
  createdBy: string;
  createdAt: string;
  employeeAName: string | null;
  employeeBName: string | null;
};

export async function fetchHrChatThreads(): Promise<HrChatThread[]> {
  const data = await gql<{ hrChatThreads: HrChatThread[] }>(
    `query { hrChatThreads { ${THREAD_FIELDS} } }`,
  );
  return data.hrChatThreads || [];
}

export async function fetchHrChatMessages(
  threadId: number,
  limit = 200,
): Promise<HrChatMessage[]> {
  const data = await gql<{ hrChatMessages: HrChatMessage[] }>(
    `query ($threadId: Int!, $limit: Int) {
      hrChatMessages(threadId: $threadId, limit: $limit) {
        id threadId senderEmployeeId senderIsManager body imageUrl createdAt senderName
      }
    }`,
    { threadId, limit },
  );
  return data.hrChatMessages || [];
}

export async function fetchHrChatBlocks(): Promise<HrChatBlock[]> {
  const data = await gql<{ hrChatBlocks: HrChatBlock[] }>(
    `query {
      hrChatBlocks {
        id HotelName pathType employeeIdA employeeIdB note createdBy createdAt
        employeeAName employeeBName
      }
    }`,
  );
  return data.hrChatBlocks || [];
}

export async function fetchHrChatHistory(input: {
  fromYmd?: string;
  toYmd?: string;
  employeeId?: number | null;
  kind?: string;
  withManager?: string;
}): Promise<HrChatThread[]> {
  const data = await gql<{ hrChatHistory: HrChatThread[] }>(
    `query (
      $fromYmd: String
      $toYmd: String
      $employeeId: Int
      $kind: String
      $withManager: String
    ) {
      hrChatHistory(
        fromYmd: $fromYmd
        toYmd: $toYmd
        employeeId: $employeeId
        kind: $kind
        withManager: $withManager
      ) { ${THREAD_FIELDS} }
    }`,
    {
      fromYmd: input.fromYmd || null,
      toYmd: input.toYmd || null,
      employeeId: input.employeeId ?? null,
      kind: input.kind || null,
      withManager: input.withManager || null,
    },
  );
  return data.hrChatHistory || [];
}

export async function fetchHrChatUnreadCount(): Promise<number> {
  const data = await gql<{ hrChatUnreadCount: number }>(
    `query { hrChatUnreadCount }`,
  );
  return data.hrChatUnreadCount || 0;
}

export async function createHrChatDirectApi(input: {
  employeeId: number;
  includeManager?: boolean;
}): Promise<HrChatThread> {
  const data = await gql<{ createHrChatDirect: HrChatThread }>(
    `mutation ($employeeId: Int!, $includeManager: Boolean) {
      createHrChatDirect(employeeId: $employeeId, includeManager: $includeManager) {
        ${THREAD_FIELDS}
      }
    }`,
    {
      employeeId: input.employeeId,
      includeManager: input.includeManager ?? true,
    },
  );
  return data.createHrChatDirect;
}

export async function createHrChatGroupApi(input: {
  title?: string;
  employeeIds: number[];
  includeManager?: boolean;
}): Promise<HrChatThread> {
  const data = await gql<{ createHrChatGroup: HrChatThread }>(
    `mutation ($title: String, $employeeIds: [Int!]!, $includeManager: Boolean) {
      createHrChatGroup(
        title: $title
        employeeIds: $employeeIds
        includeManager: $includeManager
      ) { ${THREAD_FIELDS} }
    }`,
    {
      title: input.title || null,
      employeeIds: input.employeeIds,
      includeManager: input.includeManager ?? true,
    },
  );
  return data.createHrChatGroup;
}

export async function sendHrChatMessageApi(
  threadId: number,
  body: string,
  imageUrl?: string | null,
): Promise<HrChatMessage> {
  const data = await gql<{ sendHrChatMessage: HrChatMessage }>(
    `mutation ($threadId: Int!, $body: String, $imageUrl: String) {
      sendHrChatMessage(threadId: $threadId, body: $body, imageUrl: $imageUrl) {
        id threadId senderEmployeeId senderIsManager body imageUrl createdAt senderName
      }
    }`,
    {
      threadId,
      body: body?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
    },
  );
  return data.sendHrChatMessage;
}

export async function markHrChatThreadReadApi(
  threadId: number,
): Promise<HrChatThread> {
  const data = await gql<{ markHrChatThreadRead: HrChatThread }>(
    `mutation ($threadId: Int!) {
      markHrChatThreadRead(threadId: $threadId) { ${THREAD_FIELDS} }
    }`,
    { threadId },
  );
  return data.markHrChatThreadRead;
}

export async function createHrChatBlockApi(input: {
  pathType: string;
  employeeIdA: number;
  employeeIdB?: number | null;
  note?: string;
}): Promise<HrChatBlock> {
  const data = await gql<{ createHrChatBlock: HrChatBlock }>(
    `mutation (
      $pathType: String!
      $employeeIdA: Int!
      $employeeIdB: Int
      $note: String
    ) {
      createHrChatBlock(
        pathType: $pathType
        employeeIdA: $employeeIdA
        employeeIdB: $employeeIdB
        note: $note
      ) {
        id HotelName pathType employeeIdA employeeIdB note createdBy createdAt
        employeeAName employeeBName
      }
    }`,
    {
      pathType: input.pathType,
      employeeIdA: input.employeeIdA,
      employeeIdB: input.employeeIdB ?? null,
      note: input.note || null,
    },
  );
  return data.createHrChatBlock;
}

export async function deleteHrChatBlockApi(id: number): Promise<boolean> {
  const data = await gql<{ deleteHrChatBlock: boolean }>(
    `mutation ($id: Int!) { deleteHrChatBlock(id: $id) }`,
    { id },
  );
  return data.deleteHrChatBlock;
}
