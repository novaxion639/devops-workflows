const STATUS_CONFIG = {
  Open:                { emoji: "🟢", label: "Open" },
  Draft:               { emoji: "📝", label: "Draft" },
  "In Progress":       { emoji: "🔄", label: "In Progress" },
  "In Review":         { emoji: "👀", label: "In Review" },
  Approved:            { emoji: "✅", label: "Approved" },
  "Changes Requested": { emoji: "🔶", label: "Changes Requested" },
  Merged:              { emoji: "🟣", label: "Merged" },
  Closed:              { emoji: "🔴", label: "Closed" },
};

export function buildPROpenedBlocks(pr) {
  return buildPRRootBlocks(pr, pr.isDraft ? "Draft" : "Open");
}

export function buildPRRootBlocks(pr, status) {
  const { emoji, label } = STATUS_CONFIG[status] || { emoji: "🟢", label: status };
  const isFinal = status === "Merged" || status === "Closed";

  const reviewersText =
    pr.reviewers?.length > 0
      ? pr.reviewers.map((r) => `@${r}`).join(", ")
      : "_None assigned_";

  const labelsText =
    pr.labels?.length > 0 ? pr.labels.map((l) => `\`${l}\``).join("  ") : null;

  const diffStats =
    pr.additions != null
      ? `+${pr.additions} / -${pr.deletions} across ${pr.changedFiles} file${pr.changedFiles !== 1 ? "s" : ""}`
      : null;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${label} — PR #${pr.prNumber}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${pr.url}|${pr.title}>*\nOpened by *@${pr.author}* in \`${pr.repoName}\``,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "View PR", emoji: true },
        url: pr.url,
        action_id: "view_pr",
      },
    },
  ];

  if (!isFinal) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Branch*\n\`${pr.headBranch}\` → \`${pr.baseBranch}\`` },
        { type: "mrkdwn", text: `*Reviewers*\n${reviewersText}` },
      ],
    });
  }

  if (!isFinal && (diffStats || labelsText)) {
    const fields = [];
    if (diffStats) fields.push({ type: "mrkdwn", text: `*Changes*\n${diffStats}` });
    if (labelsText) fields.push({ type: "mrkdwn", text: `*Labels*\n${labelsText}` });
    blocks.push({ type: "section", fields });
  }

  if (!isFinal && pr.body?.trim()) {
    const preview = pr.body.trim().slice(0, 300);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Description*\n${preview}${pr.body.length > 300 ? "…" : ""}`,
      },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: isFinal
          ? `*<${pr.repoUrl}|${pr.repoName}>* • This PR is ${label.toLowerCase()}`
          : `*<${pr.repoUrl}|${pr.repoName}>* • Updates appear as replies in this thread`,
      },
    ],
  });

  return blocks;
}
