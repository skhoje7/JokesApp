import { Agent } from "@openai/agentkit";

// Simple in-memory memory of the latest topic. In a long-lived environment this
// gives the agent a touch of personality between jokes.
let lastTopicMemory = "";

// AgentKit agents keep track of their own conversation state, so we can reuse
// this instance across requests to preserve context (e.g., letting the bot riff
// on previous topics if desired).
const comedianAgent = new Agent({
  name: "ComedianBot",
  instructions:
    "You are a friendly stand-up comedian who tells short, family-friendly jokes with witty timing. Keep responses under 3 sentences.",
  model: "gpt-4o-mini"
});

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

    // Persist the previous topic in the prompt so the agent can call back to it
    // if it wants to maintain continuity in its routine.
    const continuityNote = lastTopicMemory
      ? ` (Last time we joked about ${lastTopicMemory}, feel free to make a clever callback if it helps the timing.)`
      : "";

    const response = await comedianAgent.respond(`Tell a ${topic} joke.${continuityNote}`);

    if (!response || typeof response !== "string") {
      throw new Error("AgentKit did not return a text joke.");
    }

    lastTopicMemory = topic;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ joke: response.trim() }));
  } catch (error) {
    console.error("ComedianBot failed to fetch joke:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "ComedianBot tripped on the mic cable. Please try again shortly."
      })
    );
  }
}

// Future extensions: AgentKit makes it straightforward to register additional
// tools (voice mode, Supabase favorites, etc.). Add them via comedianAgent.use()
// and call those tools from respond() prompts without restructuring this API.
