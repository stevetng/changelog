import type { Adapter, AdapterResult, ChangelogEntry } from "./types.ts";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
  html_url: string;
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function fetchReleases(
  repo: string,
  token?: string,
  tags?: string[]
): Promise<{ entries: ChangelogEntry[]; errors: string[] }> {
  const entries: ChangelogEntry[] = [];
  const errors: string[] = [];

  try {
    const releases = await fetchJson<GitHubRelease[]>(
      `https://api.github.com/repos/${repo}/releases?per_page=30`,
      token
    );

    for (const release of releases) {
      if (release.draft) continue;

      entries.push({
        id: "",
        platform: "github",
        platformId: `github:release:${repo}:${release.id}`,
        date: release.published_at,
        title: `${release.name || release.tag_name} (${repo})`.slice(0, 200),
        body: release.body?.slice(0, 2000) ?? undefined,
        url: release.html_url,
        tags: [...(tags ?? []), "release", ...(release.prerelease ? ["prerelease"] : [])],
        rawData: release,
      });
    }
  } catch (err) {
    errors.push(`Failed to fetch releases for ${repo}: ${(err as Error).message}`);
  }

  return { entries, errors };
}

async function fetchCommits(
  repo: string,
  token?: string,
  tags?: string[]
): Promise<{ entries: ChangelogEntry[]; errors: string[] }> {
  const entries: ChangelogEntry[] = [];
  const errors: string[] = [];

  try {
    const commits = await fetchJson<GitHubCommit[]>(
      `https://api.github.com/repos/${repo}/commits?per_page=30`,
      token
    );

    for (const commit of commits) {
      const firstLine = commit.commit.message.split("\n")[0];

      entries.push({
        id: "",
        platform: "github",
        platformId: `github:commit:${repo}:${commit.sha}`,
        date: commit.commit.author.date,
        title: `${firstLine} (${repo})`.slice(0, 200),
        body: commit.commit.message.includes("\n")
          ? commit.commit.message.split("\n").slice(1).join("\n").trim()
          : undefined,
        url: commit.html_url,
        tags: [...(tags ?? []), "commit"],
        rawData: commit,
      });
    }
  } catch (err) {
    errors.push(`Failed to fetch commits for ${repo}: ${(err as Error).message}`);
  }

  return { entries, errors };
}

export const githubAdapter: Adapter = {
  name: "github",

  async fetch(config): Promise<AdapterResult> {
    const repos = config.repos as string[] | undefined;
    if (!repos?.length) {
      return { entries: [], errors: ["GitHub adapter requires a 'repos' config field (array of owner/repo)"] };
    }

    const token = config.token as string | undefined;
    const include = (config.include as string) ?? "releases";
    const tags = (config.tagAs as string[]) ?? [];

    const allEntries: ChangelogEntry[] = [];
    const allErrors: string[] = [];

    const tasks = repos.map(async (repo) => {
      if (include === "releases" || include === "both") {
        const result = await fetchReleases(repo, token, tags);
        allEntries.push(...result.entries);
        allErrors.push(...result.errors);
      }

      if (include === "commits" || include === "both") {
        const result = await fetchCommits(repo, token, tags);
        allEntries.push(...result.entries);
        allErrors.push(...result.errors);
      }
    });

    await Promise.allSettled(tasks);

    return {
      entries: allEntries,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  },
};
