import React, { useState, useEffect } from "react";
import {
  fetchMessages,
  saveMessageToFirestore,
  fetchCompanyBots,
} from "./firebase";
import { sendToOpenAI } from "./openai";
import "./AdminView.css"; // ✅ CSS共通利用

function EmployeeDashboard({ companyId, employeeId }) {
  const [bots, setBots] = useState([]);
  const [botPrompts, setBotPrompts] = useState({});
  const [selectedBot, setSelectedBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // 🔸 Bot一覧取得
  useEffect(() => {
    const getBots = async () => {
      const botData = await fetchCompanyBots(companyId);
      setBotPrompts(botData);
      setBots(Object.keys(botData));
    };
    if (companyId) getBots();
  }, [companyId]);

  // 🔸 メッセージ取得
  useEffect(() => {
    const getMessages = async () => {
      const data = await fetchMessages(companyId, employeeId);
      // 🔁 時系列順に並び替え
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(data);
    };
    if (companyId && employeeId) getMessages();
  }, [companyId, employeeId]);

  // 🔸 送信処理
  const handleSend = async () => {
    if (!input.trim() || !selectedBot) return;

    const userMsg = {
      sender: employeeId,
      receiver: selectedBot,
      text: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    await saveMessageToFirestore({
      companyId,
      employeeId,
      ...userMsg,
    });

    const relevantMessages = [...messages, userMsg]
      .filter(
        (msg) =>
          (msg.sender === employeeId && msg.receiver === selectedBot) ||
          (msg.sender === selectedBot && msg.receiver === employeeId)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const openAIMessages = relevantMessages.map((msg) => ({
      role: msg.sender === employeeId ? "user" : "assistant",
      content: msg.text,
    }));

    const prompt =
      botPrompts[selectedBot]?.prompt || "あなたは親切なAIです。";

    const replyText = await sendToOpenAI(openAIMessages, prompt);

    const aiReply = {
      sender: selectedBot,
      receiver: employeeId,
      text: replyText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, aiReply]);

    await saveMessageToFirestore({
      companyId,
      employeeId,
      ...aiReply,
    });
  };

  return (
    <div className="admin-container">
      {/* 左：Bot選択 */}
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

      {/* 中央：チャットエリア */}
      <div className="admin-center">
        <h2>
          {selectedBot
            ? `${selectedBot}とのチャット`
            : "← 分身AIを選んでください"}
        </h2>

        <div className="admin-chat-box">
          {selectedBot &&
            messages
              .filter(
                (msg) =>
                  msg.receiver === selectedBot ||
                  msg.sender === selectedBot
              )
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map((msg, index) => (
                <div
                  key={index}
                  style={{
                    textAlign: "left",
                    marginBottom: "10px",
                  }}
                >
                  <strong>{msg.sender}</strong>: {msg.text}
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
