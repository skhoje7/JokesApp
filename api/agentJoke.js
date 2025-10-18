import OpenAI from "openai";

// Create the OpenAI client once. The SDK reads the API key from the environment.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const message =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : topic
        ? `Tell a short, family-friendly joke about ${topic}.`
        : "";
    const agentId =
      typeof body.agentId === "string" && body.agentId.trim()
        ? body.agentId.trim()
        : typeof process.env.OPENAI_AGENT_ID === "string"
        ? process.env.OPENAI_AGENT_ID.trim()
        : "";
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : undefined;
    const workflowId =
      typeof body.workflowId === "string" && body.workflowId.trim()
        ? body.workflowId.trim()
        : undefined;

    if (!message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "A message is required." }));
      return;
    }

    if (!agentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "An OpenAI Agent ID is required. Provide it in the request body or set OPENAI_AGENT_ID."
        })
      );
      return;
    }

    // Calling an Agent Builder agent keeps track of memory on OpenAI's side when
    // a session identifier is reused. This allows the comedian to remember prior
    // topics without us persisting anything in our own infrastructure.
    const response = await client.responses.create({
      agent_id: agentId,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message
            }
          ]
        }
      ],
      // Reusing a session ID lets Agent Builder stitch conversations together
      // and remember prior topics. Workflow IDs come from Agent SDK snippets
      // and are useful when you want trace metadata for observability.
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(workflowId ? { metadata: { workflow_id: workflowId } } : {})
    });

    let joke = "";
    if (typeof response.output_text === "string") {
      joke = response.output_text.trim();
    } else if (Array.isArray(response.output)) {
      joke = response.output
        .map(block =>
          (block?.content ?? [])
            .map(part => (typeof part?.text === "string" ? part.text : ""))
            .join("")
        )
        .join(" ")
        .trim();
    }

    if (!joke) {
      throw new Error("Agent response did not include text content.");
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ joke }));
  } catch (error) {
    console.error("Comedian agent failed to fetch joke:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "ComedianBot tripped on the mic cable. Please try again shortly."
      })
    );
  }
}

// Future extensions: register Agent Builder tools (voice mode, Supabase
// favorites, etc.) in the Agent UI, then simply call them from this endpoint by
// adjusting the prompt or using function-calling outputs.
