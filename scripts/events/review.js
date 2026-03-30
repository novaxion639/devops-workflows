import { getPRData, getReviewData } from "../env-parser.js";
import { postToSlack, updateSlackMessage, addSlackReaction } from "../slack/client.js";
import { upsertNotionPR } from "../notion/client.js";
import { buildPRRootBlocks } from "../slack/block-builders.js";
import { getThreadTs } from "../slack/thread-store.js";

const action = process.env.EVENT_ACTION;

export async function handlePullRequestReview() {
  const pr = getPRData();
  const review = getReviewData();

  console.log(`[review] action=${action}, state=${review.state}, reviewer=${review.author}`);

  const ts = await getThreadTs(pr);
  if (!ts) {
    console.log(`[review] No thread for PR #${pr.prNumber} — skipping`);
    return;
  }

  const bodySnippet = review.body
    ? `\n> ${review.body.slice(0, 120)}${review.body.length > 120 ? "…" : ""}`
    : "";

  if (action === "submitted") {
    switch (review.state) {
      case "approved": {
        await postToSlack({
          text: `✅ *Approved* by <${review.url}|@${review.author}>${bodySnippet}`,
          threadTs: ts,
        });
        await addSlackReaction(pr, "white_check_mark");
        await updateSlackMessage({
          ts,
          blocks: buildPRRootBlocks(pr, "Approved"),
          text: `PR #${pr.prNumber} — Approved`,
        });
        await upsertNotionPR({ ...pr, notionStatus: "Approved" });
        break;
      }

      case "changes_requested": {
        await postToSlack({
          text: `🔶 *Changes requested* by <${review.url}|@${review.author}>${bodySnippet}`,
          threadTs: ts,
        });
        await addSlackReaction(pr, "large_orange_diamond");
        await updateSlackMessage({
          ts,
          blocks: buildPRRootBlocks(pr, "Changes Requested"),
          text: `PR #${pr.prNumber} — Changes Requested`,
        });
        await upsertNotionPR({ ...pr, notionStatus: "Changes Requested" });
        break;
      }

      case "commented": {
        if (!review.body?.trim()) return;
        await postToSlack({
          text: `💬 *Review comment* by <${review.url}|@${review.author}>${bodySnippet}`,
          threadTs: ts,
        });
        break;
      }
    }
  }

  if (action === "dismissed") {
    const reason = review.body || "No reason provided";
    await postToSlack({
      text: `↩️ *Review dismissed* (was by @${review.author}): ${reason.slice(0, 100)}`,
      threadTs: ts,
    });
    await updateSlackMessage({
      ts,
      blocks: buildPRRootBlocks(pr, "In Review"),
      text: `PR #${pr.prNumber} — In Review`,
    });
    await upsertNotionPR({ ...pr, notionStatus: "In Review" });
  }
}
