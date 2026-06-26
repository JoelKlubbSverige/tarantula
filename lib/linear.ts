const ENDPOINT = "https://api.linear.app/graphql";
const API_KEY = process.env.LINEAR_API_KEY!;
export const TEAM_ID = process.env.LINEAR_TEAM_ID!;
export const TRIAGE_STATE_ID = process.env.LINEAR_TRIAGE_STATE_ID!;

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface LUser { id: string; name: string; displayName: string; avatarUrl?: string; }
export interface LProject { id: string; name: string; }
export interface LCycle { id: string; name: string; number: number; startsAt: string; endsAt: string; }
export interface LLabel { id: string; name: string; color: string; }

export interface LinearMeta {
  users: LUser[];
  projects: LProject[];
  cycles: LCycle[];
  labels: LLabel[];
}

const META_QUERY = `
  query Meta($teamId: ID!) {
    users(filter: { active: { eq: true } }) {
      nodes { id name displayName avatarUrl }
    }
    projects(
      filter: { status: { type: { nin: ["completed", "canceled"] } } }
      first: 50
    ) {
      nodes { id name }
    }
    cycles(
      filter: { team: { id: { eq: $teamId } } }
      first: 10
    ) {
      nodes { id name number startsAt endsAt }
    }
    issueLabels(first: 100) {
      nodes { id name color }
    }
  }
`;

export async function fetchLinearMeta(): Promise<LinearMeta> {
  const data = await gql<{
    users: { nodes: LUser[] };
    projects: { nodes: LProject[] };
    cycles: { nodes: LCycle[] };
    issueLabels: { nodes: LLabel[] };
  }>(META_QUERY, { teamId: TEAM_ID });

  return {
    users: data.users.nodes,
    projects: data.projects.nodes,
    cycles: data.cycles.nodes,
    labels: data.issueLabels.nodes,
  };
}

const CREATE_ISSUE = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { id identifier url }
    }
  }
`;

export interface CreateIssueInput {
  title: string;
  description?: string;
  priority?: number;
  labelIds?: string[];
  assigneeId?: string;
  projectId?: string;
  cycleId?: string;
  estimate?: number;
}

export async function createLinearIssue(input: CreateIssueInput) {
  const data = await gql<{ issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } } }>(
    CREATE_ISSUE,
    {
      input: {
        ...input,
        teamId: TEAM_ID,
        stateId: TRIAGE_STATE_ID,
      },
    }
  );
  return data.issueCreate;
}
