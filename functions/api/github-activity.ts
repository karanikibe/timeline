type Env = {
  GITHUB_ACTIVITY_TOKEN?: string;
  GITHUB_TOKEN?: string;
};

type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo?: {
    name?: string;
  };
  payload?: {
    commits?: Array<unknown>;
  };
};

type ActivityItem = {
  id: string;
  type: string;
  repo: string;
  createdAt: string;
  commitCount: number;
};

const MAX_LIMIT = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120"
    }
  });

const normalizeLimit = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "5", 10);
  if (Number.isNaN(parsed) || parsed < 1) return 5;
  return Math.min(parsed, MAX_LIMIT);
};

const toItem = (event: GitHubEvent): ActivityItem => ({
  id: event.id,
  type: event.type,
  repo: event.repo?.name ?? "Unknown repository",
  createdAt: event.created_at,
  commitCount: Array.isArray(event.payload?.commits) ? event.payload.commits.length : 0
});

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") ?? "").trim();
  const limit = normalizeLimit(url.searchParams.get("limit"));

  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    return json({ error: "Invalid GitHub username." }, 400);
  }

  const token = env.GITHUB_ACTIVITY_TOKEN ?? env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kakaruto.com-portfolio"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/events/public?per_page=${limit}`,
      { headers }
    );

    if (!response.ok) {
      return json({ error: "GitHub API unavailable.", status: response.status }, 502);
    }

    const events = (await response.json()) as GitHubEvent[];
    return json({ events: events.slice(0, limit).map(toItem) });
  } catch {
    return json({ error: "Failed to fetch GitHub activity." }, 502);
  }
};
