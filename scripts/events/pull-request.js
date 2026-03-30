import { getPRData } from "../env-parser.js";
import { postToSlack, updateSlackMessage, addSlackReaction } from "../slack/client.js";
import { upsertNotionPR } from "../notion/client.js";
import { buildPROpenedBlocks, buildPRRootBlocks } from "../slack/block-builders.js";
import { getThreadTs, saveThreadTs } from "../slack/thread-store.js";

const action = process.env.EVENT_ACTION;

export async function handlePullRequest() {
  const pr = getPRData();

  console.log(`[pull_request] action=${action}, pr=#${pr.prNumber}, reviewers=${pr.reviewers.join(",")}`);

  switch (action) {
    case "opened":
    case "ready_for_review": {
      const blocks = buildPROpenedBlocks(pr);
      const ts = await postToSlack({
        blocks,
        text: `PR #${pr.prNumber}: ${pr.title}`,
      });
      if (ts) await saveThreadTs(pr, ts);
      await upsertNotionPR({ ...pr, notionStatus: pr.isDraft ? "Draft" : "Open" });
      break;
    }

    case "synchronize": {
      await replyToThread(pr, `🔄 *Branch updated* on \`${pr.headBranch}\``);
      await upsertNotionPR({ ...pr, notionStatus: "In Progress" });
      break;
    }

    case "edited": {
      await replyToThread(pr, `✏️ *PR updated* by @${pr.author}`);
      await upsertNotionPR({ ...pr });
      break;
    }

    case "converted_to_draft": {
      await replyToThread(pr, `📝 *Converted to draft* by @${pr.author}`);
      await updateRootStatus(pr, "Draft");
      await upsertNotionPR({ ...pr, notionStatus: "Draft" });
      break;
    }

    case "review_requested": {
      const reviewer = process.env.REVIEWERS?.split(",").filter(Boolean).pop() || "someone";
      await replyToThread(pr, `👀 *Review requested* from \`${reviewer}\``);
      await updateRootStatus(pr, "In Review");
      await upsertNotionPR({ ...pr });
      break;
    }

    case "closed": {
      const status = pr.merged ? "Merged" : "Closed";
      const emoji = pr.merged ? "purple_circle" : "red_circle";
      const update = pr.merged
        ? `🟣 *PR merged* by @${pr.mergedBy} into \`${pr.baseBranch}\``
        : `🔴 *PR closed* (unmerged) by @${pr.author}`;
      await replyToThread(pr, update);
      await updateRootStatus(pr, status);
      await addSlackReaction(pr, emoji);
      await upsertNotionPR({ ...pr, notionStatus: status });
      break;
    }

    case "reopened": {
      await replyToThread(pr, `🔁 *PR reopened* by @${pr.author}`);
      await updateRootStatus(pr, "Open");
      await upsertNotionPR({ ...pr, notionStatus: "Open" });
      break;
    }

    default:
      console.log(`[pull_request] Unhandled action: ${action}`);
  }
}

async function replyToThread(pr, text) {
  const ts = await getThreadTs(pr);
  if (!ts) {
    console.log(`[pull_request] No thread found for PR #${pr.prNumber} — skipping reply`);
    return;
  }
  await postToSlack({ text, threadTs: ts });
}

async function updateRootStatus(pr, status) {
  const ts = await getThreadTs(pr);
  if (!ts) return;
  const blocks = buildPRRootBlocks(pr, status);
  await updateSlackMessage({ ts, blocks, text: `PR #${pr.prNumber}: ${pr.title} — ${status}` });
}
