import { getPRData, getCommentData } from "../env-parser.js";
import { postToSlack, addSlackReaction } from "../slack/client.js";
import { getThreadTs } from "../slack/thread-store.js";

export async function handlePullRequestReviewComment() {
  const pr = getPRData();
  const comment = getCommentData();

  console.log(`[review_comment] author=${comment.author}, file=${comment.file}`);

  const ts = await getThreadTs(pr);
  if (!ts) return;

  const body = comment.body?.slice(0, 200) || "";
  const location = comment.file
    ? ` on \`${comment.file}${comment.line ? `:${comment.line}` : ""}\``
    : "";

  await postToSlack({
    text:
      `💬 *<${comment.url}|Inline comment>* by @${comment.author}${location}` +
      (body ? `\n> ${body}${comment.body?.length > 200 ? "…" : ""}` : ""),
    threadTs: ts,
  });

  await addSlackReaction(pr, "speech_balloon");
}

export async function handleIssueComment() {
  const pr = getPRData();
  const comment = getCommentData();

  console.log(`[issue_comment] author=${comment.author}`);

  const ts = await getThreadTs(pr);
  if (!ts) return;

  const body = comment.body?.slice(0, 200) || "";

  await postToSlack({
    text:
      `💬 *<${comment.url}|Comment>* by @${comment.author}` +
      (body ? `\n> ${body}${comment.body?.length > 200 ? "…" : ""}` : ""),
    threadTs: ts,
  });

  await addSlackReaction(pr, "speech_balloon");
}
