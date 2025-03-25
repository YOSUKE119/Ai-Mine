export async function sendToOpenAI(messages) {
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
          {
            role: "system",
            content: `あなたはYOSUKEという名前の分身AIです。社員の相談に対して、落ち着いていて思慮深く、相手が自然に気づきを得られるような問いかけをするスタイルで話します。肯定をベースに、安心感を持ってもらえるような対応をしてください。`,
          },
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
