/**
 * Slack API client for GitHub Actions.
 * Uses fetch directly (no SDK needed) to keep the install footprint tiny.
 */

const TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL = process.env.SLACK_CHANNEL_ID;

async function slackApi(method, body) {
  if (!TOKEN || !CHANNEL) {
    console.log(`[slack] Skipping ${method} — token or channel not set`);
    return null;
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.ok) {
    console.error(`[slack] ${method} failed:`, data.error);
    return null;
  }

  return data;
}

/**
 * Posts a message to the PR channel.
 * If threadTs is provided, posts as a thread reply.
 * Returns the message timestamp (ts) on success.
 */
export async function postToSlack({ text, blocks, threadTs }) {
  const data = await slackApi("chat.postMessage", {
    channel: CHANNEL,
    text,
    blocks,
    thread_ts: threadTs,
    unfurl_links: false,
    unfurl_media: false,
    mrkdwn: true,
  });
  return data?.ts || null;
}

/**
 * Updates an existing Slack message in place.
 */
export async function updateSlackMessage({ ts, blocks, text }) {
  await slackApi("chat.update", {
    channel: CHANNEL,
    ts,
    blocks,
    text,
  });
}

/**
 * Adds a reaction to the root PR message.
 * Removes conflicting status reactions first.
 */
const STATUS_EMOJIS = [
  "white_check_mark",
  "large_orange_diamond",
  "purple_circle",
  "red_circle",
  "leftwards_arrow_with_hook",
];

export async function addSlackReaction(pr, emoji) {
  const { getThreadTs } = await import("./thread-store.js");
  const ts = await getThreadTs(pr);
  if (!ts) return;

  // Remove conflicting status emojis
  if (STATUS_EMOJIS.includes(emoji)) {
    for (const e of STATUS_EMOJIS) {
      if (e === emoji) continue;
      await slackApi("reactions.remove", { channel: CHANNEL, name: e, timestamp: ts });
    }
  }

  await slackApi("reactions.add", { channel: CHANNEL, name: emoji, timestamp: ts });
}
