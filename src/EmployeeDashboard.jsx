import React, { useState, useEffect } from "react";
import { fetchMessages, saveMessageToFirestore } from "./firebase";
import { sendToOpenAI } from "./openai";
import { companyBots } from "./data/systemPrompts";
import "./AdminView.css"; // ✅ 管理職と同じCSS適用

function EmployeeDashboard({ companyId = "companyA", employeeId = "user1" }) {
  const bots = Object.keys(companyBots[companyId]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const getMessages = async () => {
      const data = await fetchMessages(employeeId);
      setMessages(data);
    };
    getMessages();
  }, [employeeId]);

  const handleSend = async () => {
    if (!input.trim() || !selectedBot) return;

    const newMessage = {
      sender: employeeId,
      receiver: selectedBot,
      text: input,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput("");

    await saveMessageToFirestore({
      employeeId,
      sender: newMessage.sender,
      receiver: newMessage.receiver,
      text: newMessage.text,
      timestamp: newMessage.timestamp,
    });

    const openAIMessages = updatedMessages
      .filter(
        (msg) => msg.receiver === selectedBot || msg.sender === selectedBot
      )
      .map((msg) => ({
        role: msg.sender === employeeId ? "user" : "assistant",
        content: msg.text,
      }));

    const systemPrompt = companyBots[companyId][selectedBot];
    const reply = await sendToOpenAI(openAIMessages, systemPrompt);

    const aiReply = {
      sender: selectedBot,
      receiver: employeeId,
      text: reply,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, aiReply]);

    await saveMessageToFirestore({
      employeeId,
      sender: aiReply.sender,
      receiver: aiReply.receiver,
      text: aiReply.text,
      timestamp: aiReply.timestamp,
    });
  };

  return (
    <div className="admin-container">
      {/* 左：AI選択 */}
      <div className="admin-sidebar">
        <h2>分身AI選択</h2>
        {bots.map((bot) => (
          <div
            key={bot}
            onClick={() => setSelectedBot(bot)}
            className={`admin-user ${selectedBot === bot ? "active" : ""}`}
          >
            🤖 {bot}
          </div>
        ))}
      </div>

      {/* 中央：チャット */}
      <div className="admin-center">
        <h2>
          {selectedBot ? `${selectedBot}とのチャット` : "← 分身AIを選んでください"}
        </h2>

        <div className="admin-chat-box">
          {selectedBot &&
            messages
              .filter(
                (msg) =>
                  msg.receiver === selectedBot || msg.sender === selectedBot
              )
              .map((msg, index) => (
                <div key={index} style={{ marginBottom: "10px" }}>
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
