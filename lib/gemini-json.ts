const TRANSIENT_GEMINI_STATUSES = new Set([
  "UNAVAILABLE",
  "INTERNAL",
  "DEADLINE_EXCEEDED",
]);

export type GeminiJsonFailure = {
  responseStatus: number;
  status: string;
  message: string;
  model?: string;
};

function geminiModels() {
  return Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
      ].filter(Boolean) as string[],
    ),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * เรียก Gemini แบบบังคับให้ตอบเป็น JSON แล้ว parse ให้เลย
 * ลองโมเดลหลักซ้ำ 1 ครั้งเมื่อเจอ error ชั่วคราว แล้วค่อยไล่โมเดลสำรอง
 * โดยรวมทุกครั้งที่ลองต้องไม่เกิน totalMs (ให้ทันก่อน serverless function หมดเวลา)
 */
export async function requestGeminiJson(
  promptText: string,
  { timeoutMs = 40_000, totalMs = 80_000, temperature = 0.7 } = {},
): Promise<{ json: unknown; model: string } | { error: GeminiJsonFailure }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      error: {
        responseStatus: 503,
        status: "MISSING_API_KEY",
        message: "ระบบไม่ได้ตั้งค่า GEMINI_API_KEY",
      },
    };
  }

  const models = geminiModels();
  const attempts = [models[0], models[0], ...models.slice(1)];
  let lastFailure: GeminiJsonFailure | null = null;
  const deadline = Date.now() + totalMs;

  for (let index = 0; index < attempts.length; index += 1) {
    const model = attempts[index];

    if (index === 1) await wait(750);

    const remainingMs = deadline - Date.now();

    if (remainingMs < 5_000) break;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(Math.min(timeoutMs, remainingMs)),
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              temperature,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (response.ok) {
        const text = (data?.candidates?.[0]?.content?.parts || [])
          .map((part: { text?: string }) => part.text || "")
          .join("");

        try {
          return { json: JSON.parse(text), model };
        } catch {
          lastFailure = {
            responseStatus: 502,
            status: "INVALID_JSON",
            message: "AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้",
            model,
          };
          continue;
        }
      }

      const status = data?.error?.status || `HTTP_${response.status}`;

      lastFailure = {
        responseStatus: response.status,
        status,
        message: String(data?.error?.message || ""),
        model,
      };
      console.warn("[gemini-json] Gemini request failed", {
        model,
        responseStatus: response.status,
        status,
      });

      const transient =
        TRANSIENT_GEMINI_STATUSES.has(status) ||
        [500, 502, 503, 504].includes(response.status);

      if (!transient) return { error: lastFailure };
    } catch (error) {
      lastFailure = {
        responseStatus: 504,
        status: "DEADLINE_EXCEEDED",
        message: error instanceof Error ? error.message : String(error),
        model,
      };
      console.warn("[gemini-json] Gemini request timed out", { model });
    }
  }

  return {
    error: lastFailure || {
      responseStatus: 502,
      status: "UNKNOWN",
      message: "ไม่สามารถเรียก AI ได้",
    },
  };
}
