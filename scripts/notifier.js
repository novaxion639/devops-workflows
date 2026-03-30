#!/usr/bin/env node
/**
 * PR Notifier — GitHub Actions Script
 * Reads event data from environment variables (set by the workflow)
 * and dispatches to Slack + Notion handlers.
 */

import { handlePullRequest } from "./events/pull-request.js";
import { handlePullRequestReview } from "./events/review.js";
import { handlePullRequestReviewComment, handleIssueComment } from "./events/review-comment.js";

const event = process.env.EVENT_NAME;
const action = process.env.EVENT_ACTION;

console.log(`[notifier] Event: ${event}, Action: ${action}`);

async function main() {
  switch (event) {
    case "pull_request":
      await handlePullRequest();
      break;
    case "pull_request_review":
      await handlePullRequestReview();
      break;
    case "pull_request_review_comment":
      await handlePullRequestReviewComment();
      break;
    case "issue_comment":
      await handleIssueComment();
      break;
    default:
      console.log(`[notifier] Unhandled event: ${event}`);
  }
}

main().catch((err) => {
  console.error("[notifier] Fatal error:", err);
  process.exit(1);
});
