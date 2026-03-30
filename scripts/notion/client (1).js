/**
 * Notion client — minimal fetch-based implementation.
 * No SDK needed, keeps the Actions install footprint small.
 */

const TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const STATUS_MAP = {
  Open:                "🟢 Open",
  Draft:               "📝 Draft",
  "In Progress":       "🔄 In Progress",
  "In Review":         "👀 In Review",
  Approved:            "✅ Approved",
  "Changes Requested": "🔶 Changes Requested",
  Merged:              "🟣 Merged",
  Closed:              "🔴 Closed",
};

async function notionApi(method, path, body) {
  if (!TOKEN || !DATABASE_ID) {
    console.log("[notion] Skipping — token or database ID not set");
    return null;
  }

  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[notion] API error ${res.status} on ${path}:`, text);
    return null;
  }

  return res.json();
}

export async function upsertNotionPR(pr) {
  try {
    const existingId = await findExistingPage(pr);
    const properties = buildProperties(pr);

    if (existingId) {
      await notionApi("PATCH", `/pages/${existingId}`, { properties });
      console.log(`[notion] Updated PR #${pr.prNumber} in ${pr.repoName}`);
    } else {
      await notionApi("POST", "/pages", {
        parent: { database_id: DATABASE_ID },
        properties,
      });
      console.log(`[notion] Created PR #${pr.prNumber} in ${pr.repoName}`);
    }
  } catch (err) {
    console.error("[notion] Error upserting PR:", err.message);
  }
}

async function findExistingPage(pr) {
  const data = await notionApi("POST", `/databases/${DATABASE_ID}/query`, {
    filter: {
      and: [
        { property: "PR Number", number: { equals: pr.prNumber } },
        { property: "Repository", rich_text: { equals: pr.repoName } },
      ],
    },
    page_size: 1,
  });
  return data?.results?.[0]?.id || null;
}

function buildProperties(pr) {
  const props = {
    Name: {
      title: [{ text: { content: `#${pr.prNumber} ${pr.title}` } }],
    },
    "PR Number": { number: pr.prNumber },
    Repository: { rich_text: [{ text: { content: pr.repoName } }] },
    Author: { rich_text: [{ text: { content: pr.author } }] },
    "PR URL": { url: pr.url },
    Branch: {
      rich_text: [{ text: { content: `${pr.headBranch} → ${pr.baseBranch}` } }],
    },
    "Last Updated": { date: { start: new Date().toISOString() } },
  };

  if (pr.notionStatus && STATUS_MAP[pr.notionStatus]) {
    props["Status"] = { select: { name: STATUS_MAP[pr.notionStatus] } };
  }

  if (pr.reviewers?.length > 0) {
    props["Reviewers"] = {
      multi_select: pr.reviewers.map((r) => ({ name: r })),
    };
  }

  if (pr.labels?.length > 0) {
    props["Labels"] = {
      multi_select: pr.labels.map((l) => ({ name: l })),
    };
  }

  return props;
}
