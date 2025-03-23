// EmployeeDashboard.jsx
import React, { useState, useEffect } from "react";
import { fetchMessages } from "./firebase";
import { sendToOpenAI } from "./openai";

function EmployeeDashboard() {
  const bots = ["YOSUKE", "MIKU", "SORA"]; // 仮の分身AIたち
  const [selectedBot, setSelectedBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const getMessages = async () => {
      const data = await fetchMessages(); // Firestoreから取得
      setMessages(data);
    };
    getMessages();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = {
      sender: "社員ユーザー",
      receiver: selectedBot,
      text: input,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput("");

    const openAIMessages = updatedMessages
      .filter(msg => msg.receiver === selectedBot)
      .map(msg => ({
        role: msg.sender === "社員ユーザー" ? "user" : "assistant",
        content: msg.text
      }));

    const reply = await sendToOpenAI(openAIMessages);

    const aiReply = {
      sender: selectedBot,
      receiver: "社員ユーザー",
      text: reply,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, aiReply]);
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0b0c10", color: "white" }}>
      {/* 左：分身AI選択 */}
      <div style={{ width: "25%", padding: "20px", backgroundColor: "#1f2833" }}>
        <h2>分身AI</h2>
        {bots.map((bot) => (
          <div
            key={bot}
            onClick={() => setSelectedBot(bot)}
            style={{
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "8px",
              backgroundColor: selectedBot === bot ? "#66fcf1" : "#45a29e",
              cursor: "pointer",
              color: "#0b0c10",
              fontWeight: "bold",
              textAlign: "center"
            }}
          >
            🤖 {bot}
          </div>
        ))}
      </div>

      {/* 右：チャット画面 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
        <h2 style={{ color: "#66fcf1" }}>
          {selectedBot ? `${selectedBot}とのチャット` : "← 分身AIを選んでください"}
        </h2>

        <div
          style={{
            flex: 1,
            marginTop: "20px",
            overflowY: "auto",
            backgroundColor: "#c5c6c7",
            padding: "15px",
            borderRadius: "10px",
            color: "black"
          }}
        >
          {selectedBot &&
            messages
              .filter(msg => msg.receiver === selectedBot || msg.sender === selectedBot)
              .map((msg, index) => (
                <div key={index} style={{ marginBottom: "10px" }}>
                  <strong>{msg.sender}</strong>: {msg.text}
                </div>
              ))}
        </div>

        {selectedBot && (
          <div style={{ marginTop: "20px", display: "flex" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力..."
              style={{ flex: 1, padding: "10px", borderRadius: "6px 0 0 6px", border: "none" }}
            />
            <button
              onClick={handleSend}
              style={{
                padding: "10px 20px",
                borderRadius: "0 6px 6px 0",
                backgroundColor: "#66fcf1",
                color: "#0b0c10",
                border: "none",
                cursor: "pointer"
              }}
            >
              送信
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeDashboard;
