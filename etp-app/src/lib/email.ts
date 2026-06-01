/**
 * Sends a password-reset email.
 *
 * - If RESEND_API_KEY is set → sends via Resend HTTP API (no extra package needed).
 * - Otherwise → logs the link to the console (dev / unconfigured environments).
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://production-planning-maestranza.vercel.app";
  const link = `${base}/auth/reset-password?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[PASSWORD RESET]\nemail: ${email}\ntoken: ${token}\nurl: ${link}`
    );
    return;
  }

  const from =
    process.env.RESEND_FROM_EMAIL ??
    "ETP Sistema <noreply@production-planning-maestranza.vercel.app>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Recuperación de contraseña — ETP",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#18181b;color:#e4e4e7;border-radius:12px;">
          <h2 style="color:#f59e0b;margin-top:0;margin-bottom:8px;">Recuperación de contraseña</h2>
          <p style="color:#a1a1aa;margin-bottom:24px;">
            Haz clic en el botón para crear una nueva contraseña.<br/>
            El enlace expira en <strong style="color:#e4e4e7;">1 hora</strong>.
          </p>
          <a href="${link}"
             style="display:inline-block;background:#f59e0b;color:#18181b;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;">
            Crear nueva contraseña
          </a>
          <p style="margin-top:28px;color:#71717a;font-size:13px;">
            Si no solicitaste este correo puedes ignorarlo. Tu contraseña no cambiará.
          </p>
          <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;" />
          <p style="color:#52525b;font-size:12px;margin:0;">
            ETP Equipos · Sistema de Planificación de Producción
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[EMAIL] Resend error ${res.status}: ${body}`);
  }
}
