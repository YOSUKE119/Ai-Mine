import React, { useState, useEffect } from "react";
import {
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
  searchSimilarMessages,
} from "./firebase";
import { db } from "./firebaseConfig";
import "./AdminView.css";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// ✅ テキスト整形関数（自然体、120文字制限）
function formatReplyText(text) {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n(\（.*?\）)\n/g, "$1 ")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/([。！？])(?=[^\n」』））])/g, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.length > 120 ? line.slice(0, 120) + "..." : line))
    .join("\n");
}

function AdminView({ companyId, adminId }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [summary, setSummary] = useState("");
  const [adminBot, setAdminBot] = useState(null);
  const [botPrompt, setBotPrompt] = useState("");

  const llm = new ChatOpenAI({
    modelName: "gpt-4.1",
    temperature: 0.3,
    openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  useEffect(() => {
    const loadData = async () => {
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

      const adminRef = doc(db, "companies", companyId, "users", adminId);
      const adminSnap = await getDoc(adminRef);
      const adminData = adminSnap.data();
      const myBot = adminData?.bot || "default_bot";
      setAdminBot(myBot);

      const botRef = doc(db, "companies", companyId, "bots", myBot);
      const botSnap = await getDoc(botRef);
      const prompt = botSnap.exists() ? botSnap.data().prompt : "あなたは親切なAIです。";
      setBotPrompt(prompt);

      const messageData = await fetchMessages(companyId, adminId);
      const filteredLog = messageData
        .filter(
          (msg) =>
            msg.botId === myBot &&
            ((msg.sender === adminId && msg.receiver === myBot) ||
              (msg.sender === myBot && msg.receiver === adminId))
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setChatLog(filteredLog);
    };

    if (companyId && adminId) loadData();
  }, [companyId, adminId]);

  const handleAdminSend = async () => {
    if (!input.trim() || !adminBot) return;

    const timestamp = new Date().toISOString();
    const newMessage = {
      sender: adminId,
      receiver: adminBot,
      text: input,
      timestamp,
      botId: adminBot,
    };

    setChatLog((prev) => [...prev, newMessage]);
    setInput("");

    await saveMessageToFirestore({
      companyId,
      employeeId: adminId,
      ...newMessage,
    });

    try {
      const similarMessages = await searchSimilarMessages({
        companyId,
        employeeId: adminId,
        queryText: input,
        topK: 5,
        botId: adminBot,
      });

      const contextText = similarMessages
        .map((msg) => `${msg.sender === adminId ? "管理職" : "分身AI"}: ${msg.text}`)
        .join("\n")
        .slice(-1500);

      const prompt = new PromptTemplate({
        inputVariables: ["systemPrompt", "context", "question"],
        template: `
{systemPrompt}

あなたは管理職の壁打ちを受ける親しみやすい分身AIです。
過去の会話を「なんとなく覚えている」程度に参照し、曖昧な返し（例:「たしか…」）も許容します。

【過去ログ（参考）】
{context}

【管理職の入力】
{question}

返答は自然体で、120文字以内を原則とし、句読点ごとに適切に改行してください。
`.trim(),
      });

      const chain = prompt.pipe(llm);
      const result = await chain.invoke({
        systemPrompt: botPrompt,
        context: contextText,
        question: input,
      });

      const cleanedText = formatReplyText(result.text);

      const aiReply = {
        sender: adminBot,
        receiver: adminId,
        text: cleanedText,
        timestamp: new Date().toISOString(),
        botId: adminBot,
      };

      setChatLog((prev) => [...prev, aiReply]);

      await saveMessageToFirestore({
        companyId,
        employeeId: adminId,
        ...aiReply,
      });
    } catch (error) {
      console.error("AI応答エラー:", error);
    }
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    try {
      const logsRef = collection(db, "companies", companyId, "users", user.employeeId, "messages");
      const q = query(logsRef, orderBy("timestamp", "asc"));
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((doc) => doc.data());

      const filtered = logs.filter(
        (msg) =>
          msg.botId === adminBot &&
          ((msg.sender === user.employeeId && msg.receiver === adminBot) ||
            (msg.sender === adminBot && msg.receiver === user.employeeId))
      );
      setMessages(filtered);

      const conversationLogs = filtered.map((m) => `${m.sender}: ${m.text}`).join("\n");

      if (!conversationLogs.trim()) {
        setSummary("❌ 会話ログが空です。総評を取得できません。");
        return;
      }

      const prompt = new PromptTemplate({
        inputVariables: ["log"],
        template: `
以下の社員との会話ログを元に、社員の状態を次の4項目で簡潔に分析してください。

1. モチベーション（高い・普通・低い）とその理由  
2. コミュニケーション傾向（例：積極的、控えめ、遠慮がち等）  
3. 抱えている悩み・課題（なければ「特になし」）  
4. 総合コメント（励ましや改善提案など、自然な日本語で簡潔に）

ログ:
{log}
`.trim(),
      });

      const chain = prompt.pipe(llm);
      const result = await chain.invoke({ log: conversationLogs });

      setSummary(result?.text ?? "❌ 総評の取得に失敗しました");
    } catch (error) {
      console.error("社員ログ取得エラー:", error);
      setSummary("❌ 総評の取得に失敗しました");
    }
  };

  return (
    <div className="admin-container">
      {/* 左パネル */}
      <div className="admin-sidebar">
        <img src="/logo.png" alt="Logo" className="admin-logo" />
        <h2>管理者</h2>
        <p>分身AI: <strong>{adminBot || "未設定"}</strong></p>

        {selectedUser && (
          <div style={{ marginTop: 20 }}>
            <h3>🧠 総評（{selectedUser.name}）</h3>
            <div className="admin-summary-box" style={{ whiteSpace: "pre-line" }}>
              {summary}
            </div>
          </div>
        )}
      </div>

      {/* 中央チャット */}
      <div className="admin-center">
        <h2>分身AIとの壁打ちチャット（{adminBot || "未設定"}）</h2>

        <div className="admin-chat-box">
          {chatLog.length === 0 ? (
            <p>※ChatGPTとの会話はまだありません</p>
          ) : (
            chatLog.map((msg, i) => {
              const isAdmin = msg.sender === adminId;
              const msgClass = isAdmin
                ? "admin-chat-message admin-chat-right"
                : "admin-chat-message admin-chat-left";
              const senderLabel = isAdmin ? "管理職" : adminBot;
              return (
                <div key={i} className={msgClass}>
                  <strong>{senderLabel}</strong>: {msg.text}
                </div>
              );
            })
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

      {/* 右パネル */}
      <div className="admin-right">
        <h4>📖 社員ログ</h4>
        {selectedUser ? (
          <div className="admin-log-box">
            {messages.length > 0 ? (
              messages.map((msg, i) => (
                <div key={i} style={{ textAlign: "left", marginBottom: "10px", whiteSpace: "pre-line" }}>
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

        <div className="admin-user-list">
          {users.map((user) => (
            <div
              key={user.employeeId}
              onClick={() => handleSelectUser(user)}
              className={`admin-user ${selectedUser?.employeeId === user.employeeId ? "active" : ""}`}
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
