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

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// テキスト整形
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

function AdminView({ companyId, adminId }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [summary, setSummary] = useState("");
  const [adminBot, setAdminBot] = useState(null);
  const [botPrompt, setBotPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("職員分析");
  const [isLoading, setIsLoading] = useState(false); // 🔄 分析中表示用のローディングステート

  const llm = new ChatOpenAI({
    modelName: "gpt-4.1",
    temperature: 0.3,
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

      try {
        const botRef = doc(db, "companies", companyId, "bots", myBot);
        const botSnap = await getDoc(botRef);
        if (botSnap.exists()) {
          setBotPrompt(botSnap.data().prompt);
        } else {
          console.warn("⚠️ botが見つかりません:", myBot);
          setBotPrompt("あなたは親切なAIです。");
        }
      } catch (e) {
        console.error("プロンプト取得エラー:", e);
        setBotPrompt("あなたは親切なAIです。");
      }

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
    if (!input.trim() || !adminBot || !botPrompt) return;

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

【過去ログ（参考）】
{context}

【管理職の入力】
{question}

返答は丁寧で自然な日本語で書いてください。
文章の長さは内容に応じて調整し、必要なら簡潔に、必要なら十分に詳しく回答してください。
改行は適切に行い、不自然な空行は避けてください。
（表情）や（動作）は文の冒頭で改行せず、文と同じ行で返してください。
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
    setIsLoading(true); // ✅ 追加：分析中の表示を開始
  
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
        setIsLoading(false); // ✅ 忘れず解除
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
    } finally {
      setIsLoading(false); // ✅ 追加：分析完了で解除
    }
  };
  
  const generateSelfAnalysis = async (logsText) => {
    const prompt = new PromptTemplate({
      inputVariables: ["log"],
      template: `
以下の1ヶ月分の会話ログをもとに、ユーザーの性格傾向をMBTIとTEGの両方で分析し、最後にそれらを掛け合わせた総評を出力してください。

【MBTI分析】
1. MBTIタイプ（4文字＋日本語ネーミング、例：INTJ（建築家））
2. MBTIタイプの根拠（発言や態度から）

【TEG分析】
1. CP（厳格な親）: 0.0〜2.0 の数値
2. NP（養育的な親）: 0.0〜2.0
3. A（大人）: 0.0〜2.0
4. FC（自由な子）: 0.0〜2.0
5. AC（順応する子）: 0.0〜2.0

2. TEGタイプ名（例：NP優勢型、A安定型、CP高型 等）
3. タイプの特徴（長所と短所）
4. 傾向（行動や思考の特徴）
5. 留意点（注意すべき点）

【MBTI × TEG 総評】
MBTIとTEGの組み合わせから読み取れる以下の観点を自然な日本語でまとめてください。
最初の1文は必ず「現在のあなたの思考は〜です」で始めてください：

- 現在のあなたの思考はどのようなスタイルか
- 対人関係の傾向（上下関係、同僚関係など）
- 職場やチームで活かせる強み
- 落とし穴やストレスの兆候
- 相性が良い/悪いタイプ（あれば）

【出力形式】
- MBTIタイプ: xxxx
- MBTI根拠: 〜〜〜
- TEG数値: CP=x.x, NP=x.x, A=x.x, FC=x.x, AC=x.x
- TEGタイプ名: ○○型
- 特徴: ○○○
- 傾向: ○○○
- 留意点: ○○○
- MBTI × TEG 総評: 現在のあなたの思考は〜です。〜〜〜

ログ:
{log}
`.trim(),
    });

    const chain = prompt.pipe(llm);
    const result = await chain.invoke({ log: logsText });
    return result.text;
  };

  const handleTabClick = async (label) => {
    setActiveTab(label);
    setIsLoading(true); // ✅ タブ切り替え時にローディング開始
    console.log(`🔍 ${label}`);
  
    // 🔧 職員分析のときはリセットして終了
    if (label === "職員分析") {
      setSelectedUser(null);     // 職員未選択にリセット
      setSummary("");            // summaryも消す
      setIsLoading(false);       // ロード解除
      return;
    }
  
    if (label === "自己分析") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
      const recentLogs = chatLog
        .filter(
          (msg) =>
            new Date(msg.timestamp) >= oneMonthAgo &&
            msg.sender === adminId
        )
        .map((msg) => `管理職: ${msg.text}`)
        .join("\n");
  
      if (!recentLogs.trim()) {
        setSummary("❌ 1ヶ月分のチャットログが見つかりません。");
        setIsLoading(false);
        return;
      }
  
      try {
        const result = await generateSelfAnalysis(recentLogs);
        setSummary(result);
      } catch (e) {
        console.error("自己分析エラー:", e);
        setSummary("❌ 自己分析に失敗しました。");
      } finally {
        setIsLoading(false); // ✅ ロード解除
      }
    }
  
    if (label === "フィードバック") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
      const feedbackLogs = chatLog
        .filter(
          (msg) =>
            new Date(msg.timestamp) >= oneMonthAgo &&
            msg.sender === adminId
        )
        .map((msg) => `管理職: ${msg.text}`)
        .join("\n");
  
      if (!feedbackLogs.trim()) {
        setSummary("❌ 1ヶ月分のチャットログが見つかりません。");
        setIsLoading(false);
        return;
      }
  
      const prompt = new PromptTemplate({
        inputVariables: ["log"],
        template: `
  以下の1ヶ月分の管理職の発言ログを元に、次の項目に基づいてフィードバックを作成してください。
  
  【フィードバック出力内容】
  1. 現時点での自己課題（過去の発言内容に基づく）
  2. 明確または暗示された目標（ある場合）
  3. 未解決の懸念やモヤモヤ（気になる発言などから推定）
  4. 今後に向けたフィードバックと提案（行動・思考のヒント）
  
  【出力フォーマット】
  - 自己課題  
  {{自己課題の内容（1行目に続けて書かず、次の行に書く）}}
  
  - 目標  
  {{目標の内容}}
  
  - 未解決事項  
  {{未解決事項の内容}}
  
  - フィードバックと提案  
  {{フィードバック本文。文頭にハイフンや記号は不要です。}}
  
  ログ:
  {log}
  `.trim(),
      });
  
      try {
        const result = await prompt.pipe(llm).invoke({ log: feedbackLogs });
        setSummary(result?.text ?? "❌ フィードバック取得に失敗しました");
      } catch (e) {
        console.error("フィードバックエラー:", e);
        setSummary("❌ フィードバックの生成に失敗しました。");
      } finally {
        setIsLoading(false); // ✅ ロード解除
      }
    }
  };
    
  return (
    <div className="admin-container">
      {/* サイドバー */}
      <div className="admin-sidebar">
        <img src="/logo.png" alt="Logo" className="admin-logo" />
        <p style={{ textAlign: "center", fontWeight: "bold", fontSize: "20px", margin: "12px 0 16px 0" }}>
  分身AI: {adminBot || "未設定"}
</p>
<div className="tab-buttons">
  {["職員分析", "自己分析", "フィードバック"].map((label) => (
    <button
      key={label}
      className={`tab-button ${activeTab === label ? "active" : ""}`}
      onClick={() => handleTabClick(label)}
    >
      {label}
    </button>
  ))}
</div>

{isLoading && (
  <div style={{ textAlign: "center", color: "#888", marginTop: "1rem" }}>
    ⏳ 分析中です...
  </div>
)}

        {summary && (
  <div className="admin-summary-wrapper">
    <h3>🧠 総評（{selectedUser?.name ?? "管理者自身"}）</h3>
    <div className="admin-summary-box">{summary}</div>
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
                <div key={i} style={{ marginBottom: "10px", whiteSpace: "pre-line" }}>
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
