const { readJson, writeJson } = require("./_github");

const SCHEDULES_PATH = "data/schedules.json";

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const { data } = await readJson(SCHEDULES_PATH, []);
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const { prompt, runAt, model, repeatDaily } = req.body || {};
      if (!prompt || !runAt) {
        return res.status(400).json({ error: "prompt and runAt are required" });
      }
      const { data, sha } = await readJson(SCHEDULES_PATH, []);
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        prompt,
        runAt,               // ISO string, e.g. 2026-08-27T09:30:00
        model: model || "claude-sonnet-4-6",
        repeatDaily: !!repeatDaily,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      data.push(entry);
      await writeJson(SCHEDULES_PATH, data, sha, `Add scheduled prompt: ${entry.id}`);
      return res.status(200).json(entry);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const { data, sha } = await readJson(SCHEDULES_PATH, []);
      const next = data.filter((s) => s.id !== id);
      await writeJson(SCHEDULES_PATH, next, sha, `Remove scheduled prompt: ${id}`);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
