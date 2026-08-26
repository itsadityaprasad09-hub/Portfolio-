const { readJson } = require("./_github");

module.exports = async (req, res) => {
  try {
    const { data } = await readJson("data/results.json", []);
    return res.status(200).json(data.slice(-50).reverse());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
