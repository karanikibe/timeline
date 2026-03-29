interface Env {
  CONTACT_FORWARD_TO: string;
  CONTACT_FROM?: string;
}

type ContactPayload = {
  name?: string;
  email?: string;
  message?: string;
  company?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: ContactPayload;

  try {
    payload = await request.json<ContactPayload>();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const message = (payload.message || "").trim();
  const honey = (payload.company || "").trim();

  if (honey) return json({ ok: true });
  if (!name || name.length > 80) return json({ error: "Invalid name." }, 400);
  if (!validEmail(email) || email.length > 120) return json({ error: "Invalid email." }, 400);
  if (!message || message.length < 10 || message.length > 3000) return json({ error: "Invalid message." }, 400);
  if (!env.CONTACT_FORWARD_TO) return json({ error: "Contact routing is not configured." }, 500);

  const from = env.CONTACT_FROM || "contact.form@kakaruto.com";

  const mailChannelsResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.CONTACT_FORWARD_TO }] }],
      from: {
        email: from,
        name: "kakaruto.com contact form"
      },
      reply_to: {
        email,
        name
      },
      subject: `New portfolio contact from ${name}`,
      content: [
        {
          type: "text/plain",
          value: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
        }
      ]
    })
  });

  if (!mailChannelsResponse.ok) {
    return json({ error: "Failed to deliver message." }, 502);
  }

  return json({ ok: true });
};
