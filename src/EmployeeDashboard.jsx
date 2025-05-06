import React, { useState, useEffect } from "react";
import {
  fetchMessages,
  saveMessageToFirestore,
  fetchCompanyBots,
  searchSimilarMessages,
} from "./firebase";
import "./AdminView.css";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// 🔧 テキスト整形関数（改行調整のみ、文字数制限なし）
function formatReplyText(text) {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n(\（.*?\）)\n/g, "$1 ")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/([。！？])(?=[^\n」』））])/g, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function EmployeeDashboard({ companyId, employeeId }) {
  const [bots, setBots] = useState([]);
  const [botPrompts, setBotPrompts] = useState({});
  const [selectedBot, setSelectedBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const llm = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-4.1",
    openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  useEffect(() => {
    const getBots = async () => {
      const botData = await fetchCompanyBots(companyId);
      const prompts = {};
      for (const botId in botData) {
        prompts[botId] = botData[botId].prompt;
      }
      setBotPrompts(prompts);
      setBots(Object.keys(prompts));
    };
    if (companyId) getBots();
  }, [companyId]);

  useEffect(() => {
    const getMessages = async () => {
      const data = await fetchMessages(companyId, employeeId);
      const filtered = data.filter(
        (msg) =>
          msg.botId === selectedBot &&
          ((msg.sender === selectedBot && msg.receiver === employeeId) ||
            (msg.sender === employeeId && msg.receiver === selectedBot))
      );
      filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(filtered);
    };
    if (companyId && employeeId && selectedBot) getMessages();
  }, [companyId, employeeId, selectedBot]);

  const handleSend = async () => {
    if (!input.trim() || !selectedBot) return;

    const timestamp = new Date().toISOString();

    const userMsg = {
      sender: employeeId,
      receiver: selectedBot,
      text: input,
      timestamp,
      botId: selectedBot,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    await saveMessageToFirestore({
      companyId,
      employeeId,
      ...userMsg,
    });

    try {
      const similarMessages = await searchSimilarMessages({
        companyId,
        employeeId,
        queryText: input,
        topK: 5,
        botId: selectedBot,
      });

      const contextText = similarMessages
        .map((msg) => `${msg.sender}: ${msg.text}`)
        .join("\n")
        .slice(-1500);

      const promptTemplate = new PromptTemplate({
        inputVariables: ["systemPrompt", "context", "question"],
        template: `
{systemPrompt}

【参考ログ】
{context}

【社員の質問】
{question}

返答は丁寧で自然な日本語で書いてください。
文章の長さは内容に応じて調整し、必要なら簡潔に、必要なら十分に詳しく回答してください。
改行は適切に行い、不自然な空行は避けてください。
（表情）や（動作）は文の冒頭で改行せず、文と同じ行で返してください。
`.trim(),
      });

      const chain = promptTemplate.pipe(llm);
      const result = await chain.invoke({
        systemPrompt: botPrompts[selectedBot],
        context: contextText,
        question: input,
      });

      const cleanedText = formatReplyText(result.text);

      const aiReply = {
        sender: selectedBot,
        receiver: employeeId,
        text: cleanedText,
        timestamp: new Date().toISOString(),
        botId: selectedBot,
      };

      setMessages((prev) => [...prev, aiReply]);

      await saveMessageToFirestore({
        companyId,
        employeeId,
        ...aiReply,
      });
    } catch (error) {
      console.error("AI応答エラー:", error);
      const errorReply = {
        sender: selectedBot,
        receiver: employeeId,
        text: "エラーが発生しました。",
        timestamp: new Date().toISOString(),
        botId: selectedBot,
      };
      setMessages((prev) => [...prev, errorReply]);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-sidebar">
        <h2>分身AI選択</h2>
        {bots.length === 0 ? (
          <p>⚠️ 利用できる分身AIがありません</p>
        ) : (
          bots.map((bot) => (
            <div
              key={bot}
              onClick={() => setSelectedBot(bot)}
              className={`admin-user ${selectedBot === bot ? "active" : ""}`}
            >
              🤖 {bot}
            </div>
          ))
        )}
      </div>

      <div className="admin-center">
        <h2>{selectedBot ? `${selectedBot}とのチャット` : "← 分身AIを選んでください"}</h2>

        <div className="admin-chat-box">
          {selectedBot &&
            messages.map((msg, index) => (
              <div
                key={index}
                className={`admin-chat-message ${
                  msg.sender === employeeId ? "admin-chat-right" : "admin-chat-left"
                }`}
              >
                <strong>{msg.sender === employeeId ? "あなた" : selectedBot}</strong>: {msg.text}
              </div>
            ))}
        </div>

        {selectedBot && (
          <div className="admin-input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力..."
            />
            <button onClick={handleSend}>送信</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeDashboard;
