// openai.js
export async function sendToOpenAI(messages, systemPrompt) {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt }, // ←ここが変わる！
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ エラー発生:", error);
      return "エラーが発生しました💦";
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error("🚨 通信エラー:", err);
    return "ネットワークか設定に問題があるかもしれません💦";
  }
}
