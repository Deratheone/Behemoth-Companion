import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Upload error" });
    }

    const file = files.image;

    if (!file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const imageData = fs.readFileSync(file.filepath);

    try {
      // 🔥 Replace this with your AI API call
      const aiResponse = await fetch("YOUR_AI_ENDPOINT", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: imageData,
      });

      const result = await aiResponse.json();

      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: "AI processing failed" });
    }
  });
}
