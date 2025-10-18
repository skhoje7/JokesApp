import OpenAI from "openai";

// Create a single OpenAI client for the lifecycle of this serverless function/file.
// The SDK will read the API key from the environment when the module is first loaded.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Helper function to read the entire body from the incoming request.
 * This is useful in environments where the framework does not pre-parse JSON.
 * @param {import('http').IncomingMessage & { body?: unknown }} req
 */
async function readRequestBody(req) {
  if (req.body && typeof req.body === "string") {
    return req.body;
  }

  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Serverless-style request handler that returns a fresh AI-generated joke.
 * @param {import('http').IncomingMessage & { method?: string }} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." }));
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!topic) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Topic is required." }));
      return;
    }

    // Ask the OpenAI model for a playful, family-friendly joke about the topic.
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: `Tell me a short, family-friendly joke about ${topic}.`
    });

    // Extract the joke text from the response payload. Different SDK versions expose
    // slightly different shapes, so we try a few common patterns defensively.
    let joke = "";
    if (typeof response.output_text === "string") {
      joke = response.output_text.trim();
    } else if (Array.isArray(response.output)) {
      joke = response.output
        .map(block => (block?.content ?? [])
          .map(part => (typeof part?.text === "string" ? part.text : ""))
          .join(""))
        .join(" ")
        .trim();
    }

    if (!joke) {
      throw new Error("The AI response did not include any text content.");
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ joke }));
  } catch (error) {
    console.error("Failed to fetch joke:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch a joke. Please try again." }));
  }
}
