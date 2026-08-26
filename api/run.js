const { readJson, writeJson } = require("./_github");

const SCHEDULES_PATH = "data/schedules.json";
const RESULTS_PATH = "data/results.json";

// Ping this route from a free external scheduler (e.g. cron-job.org) every
// 5-15 minutes: https://<your-project>.vercel.app/api/run?key=YOUR_CRON_SECRET
// Vercel's own free cron only fires once a day, so the external pinger is
// what actually gives you real, on-time scheduling.

module.exports = async (req, res) => {
  try {
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "bad key" });
    }

    const now = new Date();
    const { data: schedules, sha: schedulesSha } = await readJson(SCHEDULES_PATH, []);
    const { data: results, sha: resultsSha } = await readJson(RESULTS_PATH, []);

    const due = schedules.filter((s) => s.status === "pending" && new Date(s.runAt) <= now);
    if (due.length === 0) {
      return res.status(200).json({ ran: 0 });
    }

    for (const job of due) {
      let output = "";
      let ok = true;
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: job.model || "claude-sonnet-4-6",
            max_tokens: 2000,
            messages: [{ role: "user", content: job.prompt }],
          }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error?.message || "Claude API error");
        output = (json.content || []).map((b) => b.text || "").join("\n");
      } catch (err) {
        ok = false;
        output = `Error: ${err.message}`;
      }

      results.push({
        id: job.id,
        prompt: job.prompt,
        output,
        ok,
        ranAt: new Date().toISOString(),
      });

      if (job.repeatDaily) {
        const next = new Date(job.runAt);
        next.setDate(next.getDate() + 1);
        while (next <= now) next.setDate(next.getDate() + 1);
        job.runAt = next.toISOString();
        job.status = "pending";
      } else {
        job.status = "done";
      }
    }

    await writeJson(RESULTS_PATH, results, resultsSha, `Log ${due.length} run(s)`);
    await writeJson(SCHEDULES_PATH, schedules, schedulesSha, `Update ${due.length} schedule(s) after run`);

    return res.status(200).json({ ran: due.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
