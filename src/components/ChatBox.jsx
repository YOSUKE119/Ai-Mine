// src/components/ChatBox.jsx

import React, { useState } from "react";
import { getOpenAIResponse } from "../services/openaiChat";

/**
 * LangChainチャットボックス
 * @param {string} userId - ユーザーID（例: adminIdやemployeeId）
 * @param {string} botId - ボットID（Firestore上のbot名）
 * @param {string} companyId - 会社ID
 */
const ChatBox = ({ userId = "user", botId = "ai", companyId = "test" }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: userId, text: input };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await getOpenAIResponse(input);

      const aiMessage = { sender: botId, text: response };
      setMessages((prev) => [...prev, aiMessage]);

      // 🔜 Firestore保存・RAGログ活用などはここに追加可

    } catch (error) {
      console.error("AI応答エラー:", error);
      const errorMessage = { sender: botId, text: "エラーが発生しました。" };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setInput("");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "1rem", border: "1px solid #ccc" }}>
      <h3>Chat with AI 🤖</h3>

      <div style={{
        height: "240px",
        overflowY: "auto",
        border: "1px solid #eee",
        padding: "0.5rem",
        marginBottom: "1rem",
        backgroundColor: "#f9f9f9"
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.sender === userId ? "right" : "left", marginBottom: "8px" }}>
            <strong>{msg.sender === userId ? "あなた" : "AI"}:</strong> {msg.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力"
          style={{ flexGrow: 1, marginRight: "1rem", padding: "0.5rem" }}
        />
        <button onClick={handleSend}>送信</button>
      </div>
    </div>
  );
};

export default ChatBox;
