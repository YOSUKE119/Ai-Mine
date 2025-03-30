import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { fetchMessages, saveMessageToFirestore } from "./firebase";
import { sendToOpenAI } from "./openai";
import app from "./firebaseConfig";
import "./AdminView.css";

const db = getFirestore(app);

function AdminView() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);

  useEffect(() => {
    const load = async () => {
      const messageData = await fetchMessages();
      setMessages(messageData);

      const querySnapshot = await getDocs(collection(db, "users"));
      const employeeUsers = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role === "employee") {
          employeeUsers.push({
            name: data.name || data.email,
            email: data.email,
          });
        }
      });
      setUsers(employeeUsers);
    };
    load();
  }, []);

  const handleAdminSend = async () => {
    if (!input.trim()) return;

    const newMessage = {
      sender: "佐藤社長",
      receiver: "sato_ai",
      text: input,
      timestamp: new Date().toISOString(),
    };

    const updatedLog = [...chatLog, newMessage];
    setChatLog(updatedLog);
    setInput("");

    await saveMessageToFirestore({
      employeeId: "admin-sato",
      sender: newMessage.sender,
      receiver: newMessage.receiver,
      text: newMessage.text,
      timestamp: newMessage.timestamp,
    });

    const openAIMessages = updatedLog.map((msg) => ({
      role: msg.sender === "佐藤社長" ? "user" : "assistant",
      content: msg.text,
    }));

    const systemPrompt = `あなたはsato_aiという名前の分身AIです。社長の意思決定を支えるパートナーとして、冷静に問いかけや要点の整理をしながら会話します。`;

    const reply = await sendToOpenAI(openAIMessages, systemPrompt);

    const aiReply = {
      sender: "sato_ai",
      receiver: "佐藤社長",
      text: reply,
      timestamp: new Date().toISOString(),
    };

    setChatLog((prev) => [...prev, aiReply]);

    await saveMessageToFirestore({
      employeeId: "admin-sato",
      sender: aiReply.sender,
      receiver: aiReply.receiver,
      text: aiReply.text,
      timestamp: aiReply.timestamp,
    });
  };

  return (
    <div className="admin-container">
      {/* 左：プロフィール＆総評 */}
      <div className="admin-sidebar">
        <img src="/logo.png" alt="Ai-Mine Logo" className="admin-logo" />
        <h2>佐藤社長</h2>
        <div className="admin-summary">
          <h4>📊 AI分析総評</h4>
          <p>🧠 社員のモチベ傾向：安定</p>
          <p>💬 コミュニケーション：対話型が増加中</p>
        </div>
      </div>

      {/* 中央：壁打ちチャット */}
      <div className="admin-center">
        <h2>分身AIとの壁打ちチャット（YOSUKE）</h2>

        <div className="admin-chat-box">
          {chatLog.length === 0 ? (
            <p>※ChatGPTとの接続はまだオフ</p>
          ) : (
            chatLog.map((msg, i) => (
              <div key={i}>
                <strong>{msg.sender}</strong>: {msg.text}
              </div>
            ))
          )}
        </div>

        {/* ✅ 入力欄は常に表示 */}
        <div className="admin-input-box">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
          />
          <button onClick={handleAdminSend}>送信</button>
        </div>
      </div>

      {/* 右：ログと社員選択 */}
      <div className="admin-right">
        <h2>
          {selectedUser ? `📖 ${selectedUser.name}のログ表示` : "← 社員を選択"}
        </h2>
        <div className="admin-log-box">
          {selectedUser ? (
            messages
              .filter(
                (msg) =>
                  msg.sender === selectedUser.email ||
                  msg.receiver === selectedUser.email
              )
              .map((msg, i) => (
                <div key={i}>
                  <strong>{msg.sender}</strong>: {msg.text}
                </div>
              ))
          ) : (
            <p>ログを見るには社員を選んでね😊</p>
          )}
        </div>

        <div className="admin-user-list">
          <h4>👥 社員リスト</h4>
          {users.map((user) => (
            <div
              key={user.email}
              onClick={() => setSelectedUser(user)}
              className={`admin-user ${
                selectedUser?.email === user.email ? "active" : ""
              }`}
            >
              💬 {user.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminView;
