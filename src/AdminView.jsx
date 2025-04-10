import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";

import {
  fetchMessages,
  saveMessageToFirestore,
} from "./firebase";

import { sendToOpenAI } from "./openai";
import app from "./firebaseConfig";
import "./AdminView.css";

const db = getFirestore(app);

function AdminView({ companyId, adminId }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [summary, setSummary] = useState("");

  const [adminBot, setAdminBot] = useState(null);
  const [botPrompt, setBotPrompt] = useState("");

  useEffect(() => {
    const loadData = async () => {
      // ✅ 1. 社員一覧を先に取得
      const userSnap = await getDocs(collection(db, "companies", companyId, "users"));
      const employeeList = [];
      userSnap.forEach((doc) => {
        const data = doc.data();
        if (data.role === "employee") {
          employeeList.push({
            name: data.name || data.email,
            email: data.email,
            employeeId: doc.id,
          });
        }
      });
      setUsers(employeeList);

      // ✅ 2. 管理者のBot情報を取得
      const adminRef = doc(db, "companies", companyId, "users", adminId);
      const adminSnap = await getDoc(adminRef);
      const adminData = adminSnap.data();
      const myBot = adminData?.bot || "sato_ai";
      setAdminBot(myBot);

      const botRef = doc(db, "companies", companyId, "bots", myBot);
      const botSnap = await getDoc(botRef);
      const prompt = botSnap.exists() ? botSnap.data().prompt : "あなたは親切なAIです。";
      setBotPrompt(prompt);

      // ✅ 3. 壁打ちチャットログの初期取得
      const messageData = await fetchMessages(companyId, adminId);
      const filteredLog = messageData.filter(
        (msg) =>
          (msg.sender === adminId && msg.receiver === myBot) ||
          (msg.sender === myBot && msg.receiver === adminId)
      );
      setChatLog(filteredLog);
    };

    if (companyId && adminId) {
      loadData();
    }
  }, [companyId, adminId]);

  const handleAdminSend = async () => {
    if (!input.trim() || !adminBot) return;

    const newMessage = {
      sender: adminId,
      receiver: adminBot,
      text: input,
      timestamp: new Date().toISOString(),
    };

    const updatedLog = [...chatLog, newMessage];
    setChatLog(updatedLog);
    setInput("");

    await saveMessageToFirestore({
      companyId,
      employeeId: adminId,
      ...newMessage,
    });

    const openAIMessages = updatedLog.map((msg) => ({
      role: msg.sender === adminId ? "user" : "assistant",
      content: msg.text,
    }));

    const reply = await sendToOpenAI(openAIMessages, botPrompt);

    const aiReply = {
      sender: adminBot,
      receiver: adminId,
      text: reply,
      timestamp: new Date().toISOString(),
    };

    setChatLog((prev) => [...prev, aiReply]);

    await saveMessageToFirestore({
      companyId,
      employeeId: adminId,
      ...aiReply,
    });
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);

    try {
      const logsRef = collection(
        db,
        "companies",
        companyId,
        "users",
        user.employeeId,
        "messages"
      );
      const q = query(logsRef, orderBy("timestamp", "asc"));
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((doc) => doc.data());

      const filtered = logs.filter(
        (msg) =>
          (msg.sender === user.employeeId && msg.receiver === adminBot) ||
          (msg.sender === adminBot && msg.receiver === user.employeeId)
      );

      setMessages(filtered);

      const prompt = `
以下は社員「${user.name}」とAIの会話ログです。この会話内容を分析し、以下の項目について日本語で簡潔にまとめてください：

1. モチベーション（高い / 普通 / 低い）

2. コミュニケーション傾向（例：前向き、消極的、積極的、遠慮がちなど）

3. 抱えている悩みや課題

4. 総合コメント（励ましや改善のヒントなど）

【会話ログ】:
${filtered.map((m) => `${m.sender}: ${m.text}`).join("\n")}
`;

      const result = await sendToOpenAI([{ role: "user", content: prompt }], botPrompt);
      setSummary(result);
    } catch (error) {
      console.error("社員ログ取得エラー:", error);
      setMessages([]);
      setSummary("❌ 総評の取得に失敗しました");
    }
  };

  return (
    <div className="admin-container">
      {/* 左：プロフィールと総評 */}
      <div className="admin-sidebar">
        <img src="/logo.png" alt="Logo" className="admin-logo" />
        <h2>管理者</h2>
        <p>分身AI: <strong>{adminBot || "未設定"}</strong></p>

        {selectedUser && (
          <div style={{ marginTop: 20 }}>
            <h3>🧠 総評（{selectedUser.name}）</h3>
            <div className="admin-summary-box" style={{ whiteSpace: "pre-line" }}>
              {summary ? summary : "分析中..."}
            </div>
          </div>
        )}
      </div>

      {/* 中央：壁打ちチャット */}
      <div className="admin-center">
        <h2>分身AIとの壁打ちチャット（{adminBot || "未設定"}）</h2>

        <div className="admin-chat-box">
          {chatLog.length === 0 ? (
            <p>※ChatGPTとの会話はまだありません</p>
          ) : (
            chatLog.map((msg, i) => (
              <div
                key={i}
                style={{ textAlign: "left", marginBottom: "10px" }}
              >
                <strong>{msg.sender === adminId ? "管理職" : adminBot}</strong>: {msg.text}
              </div>
            ))
          )}
        </div>

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

      {/* 右：社員ログとリスト */}
      <div className="admin-right">
        <h4>📖 社員ログ</h4>
        {selectedUser ? (
          <div className="admin-log-box">
            {messages.length > 0 ? (
              messages.map((msg, i) => (
                <div key={i} style={{ textAlign: "left", marginBottom: "10px" }}>
                  <strong>{msg.sender === adminBot ? adminBot : selectedUser.name}</strong>: {msg.text}
                </div>
              ))
            ) : (
              <p>この社員のログはまだありません。</p>
            )}
          </div>
        ) : (
          <p>社員を選んでログを見る</p>
        )}

        {/* ✅ 常に表示 */}
        <div className="admin-user-list">
          {users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.employeeId}
                onClick={() => handleSelectUser(user)}
                className={`admin-user ${
                  selectedUser?.employeeId === user.employeeId ? "active" : ""
                }`}
              >
                💬 {user.name}
              </div>
            ))
          ) : (
            <p>社員データがありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminView;
