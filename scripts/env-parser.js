/**
 * Extracts and normalizes PR data from GitHub Actions environment variables.
 * All event handlers call this to get a consistent prData object.
 */
export function getPRData() {
  return {
    prNumber: parseInt(process.env.PR_NUMBER, 10),
    title: process.env.PR_TITLE || "",
    url: process.env.PR_URL || "",
    author: process.env.PR_AUTHOR || "",
    body: process.env.PR_BODY || "",
    isDraft: process.env.PR_DRAFT === "true",
    merged: process.env.PR_MERGED === "true",
    mergedBy: process.env.PR_MERGED_BY || "",
    headBranch: process.env.HEAD_BRANCH || "",
    baseBranch: process.env.BASE_BRANCH || "",
    repoName: process.env.REPO_NAME || "",
    repoUrl: process.env.REPO_URL || "",
    additions: parseInt(process.env.ADDITIONS, 10) || 0,
    deletions: parseInt(process.env.DELETIONS, 10) || 0,
    changedFiles: parseInt(process.env.CHANGED_FILES, 10) || 0,
    reviewers: process.env.REVIEWERS
      ? process.env.REVIEWERS.split(",").filter(Boolean)
      : [],
    labels: process.env.LABELS
      ? process.env.LABELS.split(",").filter(Boolean)
      : [],
  };
}

export function getReviewData() {
  return {
    state: process.env.REVIEW_STATE || "",
    author: process.env.REVIEW_AUTHOR || "",
    body: process.env.REVIEW_BODY || "",
    url: process.env.REVIEW_URL || "",
  };
}

export function getCommentData() {
  return {
    author: process.env.COMMENT_AUTHOR || "",
    body: process.env.COMMENT_BODY || "",
    url: process.env.COMMENT_URL || "",
    file: process.env.COMMENT_FILE || "",
    line: process.env.COMMENT_LINE || "",
  };
}
