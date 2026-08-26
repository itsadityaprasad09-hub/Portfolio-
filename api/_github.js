// Small helper: read/write JSON files inside this same GitHub repo,
// using the Contents API, so schedules + results survive across
// serverless invocations without needing a separate database.

const REPO = process.env.GITHUB_REPO;           // e.g. "itsadityaprasad09-hub/Portfolio-"
const TOKEN = process.env.GITHUB_TOKEN;         // repo-scoped PAT, set in Vercel env vars
const BRANCH = process.env.GITHUB_BRANCH || "main";

async function ghRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function readJson(path, fallback) {
  const res = await ghRequest(`${path}?ref=${BRANCH}`);
  if (res.status === 404) return { data: fallback, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  const file = await res.json();
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: file.sha };
}

async function writeJson(path, data, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await ghRequest(path, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  return res.json();
}

module.exports = { readJson, writeJson };
