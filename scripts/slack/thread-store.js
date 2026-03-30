/**
 * Thread store for GitHub Actions.
 *
 * The challenge: GitHub Actions are stateless — each run has no memory of
 * previous runs. We need to persist the Slack thread_ts (root message
 * timestamp) so that follow-up events (reviews, comments, merges) can
 * reply to the correct thread.
 *
 * Solution: Store thread_ts values in a dedicated GitHub Actions cache
 * keyed by repo + PR number. The cache persists across workflow runs
 * for up to 7 days (GitHub's default), which covers the lifetime of most PRs.
 *
 * Cache key format: pr-thread-{repo}-{prNumber}
 * Cache value: plain text Slack thread_ts
 *
 * Requires: GITHUB_TOKEN and ACTIONS_CACHE_URL env vars (set automatically
 * by GitHub Actions runtime — no configuration needed).
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const CACHE_DIR = "/tmp/pr-threads";

function cacheKey(pr) {
  // Sanitize repo name for use in a file path
  const safeRepo = pr.repoName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `pr_thread_${safeRepo}_${pr.prNumber}`;
}

function cachePath(pr) {
  return path.join(CACHE_DIR, `${cacheKey(pr)}.txt`);
}

/**
 * Saves a Slack thread_ts for a PR using the GitHub Actions cache.
 * Falls back to a local file if cache isn't available.
 */
export async function saveThreadTs(pr, ts) {
  mkdirSync(CACHE_DIR, { recursive: true });

  // Write to local file (used within the same job)
  writeFileSync(cachePath(pr), ts, "utf8");

  // Save to GitHub Actions cache for future workflow runs
  try {
    const key = cacheKey(pr);
    // Use @actions/cache via CLI if available, otherwise use the REST API
    execSync(
      `echo "${ts}" > ${cachePath(pr)} && \
       tar -czf /tmp/${key}.tar.gz -C ${CACHE_DIR} ${cacheKey(pr)}.txt`,
      { stdio: "pipe" }
    );
    await saveToActionsCache(key, `/tmp/${key}.tar.gz`);
    console.log(`[thread-store] Saved thread ts ${ts} for PR #${pr.prNumber}`);
  } catch (err) {
    console.warn("[thread-store] Cache save failed (non-fatal):", err.message);
  }
}

/**
 * Retrieves the Slack thread_ts for a PR.
 * Checks local file first, then GitHub Actions cache.
 */
export async function getThreadTs(pr) {
  // Check local file first (same job)
  if (existsSync(cachePath(pr))) {
    return readFileSync(cachePath(pr), "utf8").trim();
  }

  // Try to restore from GitHub Actions cache
  try {
    const key = cacheKey(pr);
    const restored = await restoreFromActionsCache(key, CACHE_DIR);
    if (restored && existsSync(cachePath(pr))) {
      const ts = readFileSync(cachePath(pr), "utf8").trim();
      console.log(`[thread-store] Restored thread ts ${ts} for PR #${pr.prNumber}`);
      return ts;
    }
  } catch (err) {
    console.warn("[thread-store] Cache restore failed:", err.message);
  }

  console.log(`[thread-store] No thread ts found for PR #${pr.prNumber}`);
  return null;
}

// ── GitHub Actions Cache REST API ────────────────────────────────────────────

async function saveToActionsCache(key, archivePath) {
  const cacheUrl = process.env.ACTIONS_CACHE_URL;
  const token = process.env.ACTIONS_RUNTIME_TOKEN;
  if (!cacheUrl || !token) return;

  const { readFileSync } = await import("fs");
  const archive = readFileSync(archivePath);
  const size = archive.length;

  // Reserve cache entry
  const reserveRes = await fetch(`${cacheUrl}_apis/artifactcache/caches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json;api-version=6.0-preview",
    },
    body: JSON.stringify({ key, version: "1" }),
  });

  if (!reserveRes.ok) return;
  const { cacheId } = await reserveRes.json();

  // Upload archive
  await fetch(`${cacheUrl}_apis/artifactcache/caches/${cacheId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${token}`,
      Accept: "application/json;api-version=6.0-preview",
      "Content-Range": `bytes 0-${size - 1}/*`,
    },
    body: archive,
  });

  // Commit
  await fetch(`${cacheUrl}_apis/artifactcache/caches/${cacheId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json;api-version=6.0-preview",
    },
    body: JSON.stringify({ size }),
  });
}

async function restoreFromActionsCache(key, targetDir) {
  const cacheUrl = process.env.ACTIONS_CACHE_URL;
  const token = process.env.ACTIONS_RUNTIME_TOKEN;
  if (!cacheUrl || !token) return false;

  const res = await fetch(
    `${cacheUrl}_apis/artifactcache/cache?keys=${encodeURIComponent(key)}&version=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json;api-version=6.0-preview",
      },
    }
  );

  if (!res.ok) return false;
  const data = await res.json();
  if (!data?.archiveLocation) return false;

  const archiveRes = await fetch(data.archiveLocation);
  const { writeFileSync } = await import("fs");
  const archivePath = `/tmp/${key}-restore.tar.gz`;
  writeFileSync(archivePath, Buffer.from(await archiveRes.arrayBuffer()));

  execSync(`tar -xzf ${archivePath} -C ${targetDir}`, { stdio: "pipe" });
  return true;
}
