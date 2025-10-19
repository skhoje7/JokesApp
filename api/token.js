import OpenAI from "openai";

// Create a reusable OpenAI client using the server-side API key stored in Vercel.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * API route: issues a short-lived ChatKit session token.
 * The browser requests this token instead of storing the permanent API key.
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Ask OpenAI for a ChatKit session. The response contains a client_secret that
    // expires after ~1 hour and can be safely shared with the browser.
    const session = await client.chatkit.sessions.create({
      expires_in: 3600,
    });

    res.status(200).json({ client_secret: session.client_secret.value });
  } catch (err) {
    console.error("Token creation error:", err);
    res.status(500).json({ error: "Failed to create ChatKit token" });
  }
}
