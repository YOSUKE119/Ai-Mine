import React, { useState, useEffect } from "react";
import { fetchMessages } from "./firebase";

function EmployeeChat() {
  const bots = ["佐藤社長", "鈴木部長", "高橋課長"];
  const [selectedBot, setSelectedBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const getMessages = async () => {
      const data = await fetchMessages();
      setMessages(data);
    };
    getMessages();
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = {
      sender: "社員ユーザー",
      receiver: selectedBot,
      text: input,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0b0c10", color: "white" }}>
      {/* 左サイド：分身AI選択 */}
      <div style={{ width: "25%", padding: "20px", backgroundColor: "#1f2833" }}>
        <h2 style={{ marginBottom: "20px" }}>分身AI選択</h2>
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

      {/* 右側：チャットエリア */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", position: "relative" }}>
        <h2 style={{ color: "#66fcf1" }}>{selectedBot ? `${selectedBot}とのチャット` : "← 分身AIを選んでください"}</h2>

        <div style={{ flex: 1, marginTop: "20px", overflowY: "auto", backgroundColor: "#c5c6c7", padding: "15px", borderRadius: "10px", color: "black" }}>
          {selectedBot && messages
            .filter(msg => msg.receiver === selectedBot)
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
              style={{ padding: "10px 20px", borderRadius: "0 6px 6px 0", backgroundColor: "#66fcf1", color: "#0b0c10", border: "none", cursor: "pointer" }}
            >
              送信
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeChat;
