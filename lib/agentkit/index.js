import OpenAI from "openai";

/**
 * Minimal AgentKit-style helper that keeps conversation state in memory and
 * proxies prompts to the OpenAI Responses API. This provides enough behavior to
 * support the ComedianBot agent without relying on an unpublished npm package.
 */
export class Agent {
  /**
   * @param {{
   *  name?: string,
   *  instructions: string,
   *  model?: string,
   *  client?: OpenAI
   * }} config
   */
  constructor(config = {}) {
    const { name = "Agent", instructions, model = "gpt-4o-mini", client } = config;

    if (!instructions) {
      throw new Error("Agent instructions are required.");
    }

    this.name = name;
    this.instructions = instructions;
    this.model = model;
    this.client = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Messages are stored in the structure expected by the Responses API so we
    // can send them verbatim on each respond() call. This keeps contextual
    // memory between requests, fulfilling the AgentKit behavior the frontend
    // expects.
    this.messages = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: `${this.instructions}\nYou are performing as ${this.name}.`
          }
        ]
      }
    ];

    this.tools = [];
  }

  /**
   * Register an imaginary tool so future work can hook into this agent. This is
   * a no-op placeholder that mirrors the AgentKit API the rest of the code
   * references.
   * @param {unknown} tool
   */
  use(tool) {
    this.tools.push(tool);
    return this;
  }

  /**
   * Reset the accumulated conversation state.
   */
  reset() {
    this.messages = this.messages.slice(0, 1);
  }

  /**
   * Send a prompt to the agent while maintaining conversational context.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async respond(prompt) {
    if (!prompt) {
      throw new Error("Agent prompt is required.");
    }

    if (!process.env.OPENAI_API_KEY && !this.client.apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable.");
    }

    this.messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        }
      ]
    });

    const response = await this.client.responses.create({
      model: this.model,
      input: this.messages
    });

    const text = extractText(response);

    if (!text) {
      throw new Error("AgentKit response did not contain text content.");
    }

    this.messages.push({
      role: "assistant",
      content: [
        {
          type: "text",
          text
        }
      ]
    });

    return text;
  }
}

/**
 * Pull plain text from a Responses API payload.
 * @param {import("openai").Response} response
 */
function extractText(response) {
  if (!response) return "";

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    const combined = response.output
      .map(block =>
        (block?.content ?? [])
          .map(part => (typeof part?.text === "string" ? part.text : ""))
          .join("")
      )
      .join(" ")
      .trim();
    if (combined) {
      return combined;
    }
  }

  const messageText = response?.data?.[0]?.content?.[0]?.text;
  if (typeof messageText === "string" && messageText.trim()) {
    return messageText.trim();
  }

  return "";
}
