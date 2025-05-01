import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * OpenAIと会話する関数（LangChain使用）
 * @param {string} userMessage - ユーザーの入力メッセージ
 * @returns {Promise<string>} - OpenAIの応答
 */
export const getOpenAIResponse = async (userMessage) => {
  try {
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) throw new Error("APIキーが設定されていません");

    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: "gpt-4.1", // または "gpt-3.5-turbo"
      openAIApiKey: apiKey,
    });

    const response = await model.call([
      new SystemMessage("あなたは親切なAIアシスタントです。すべての返答は日本語で行ってください。"),
      new HumanMessage(userMessage),
    ]);

    return response.text;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return "エラーが発生しました";
  }
};
