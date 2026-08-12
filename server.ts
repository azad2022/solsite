  let serverGitHubToken = String(
    process.env.GITHUB_MEDIA_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.VITE_GITHUB_TOKEN ||
    ""
  ).trim();
