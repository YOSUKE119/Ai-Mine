// このファイルは非推奨になりました。
// LangChain構成に完全移行したため、旧OpenAI直接呼び出しは不要です。
// 必要であれば、下記のようなレガシー対応関数を一時的に使用可能です（非推奨）。

/*
export async function legacySendToOpenAI(messages, systemPrompt) {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: systemPrompt },
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
*/
