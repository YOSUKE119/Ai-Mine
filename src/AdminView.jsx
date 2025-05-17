import React, { useState, useEffect, useRef } from "react"; // ← useRef を必ず含める
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from 'rehype-highlight';


// テキスト整形
function formatReplyText(text) {
  return text
    // 表情（にこっと笑って）などをすべて削除
    .replace(/\（.*?[\u3040-\u30ffー]+.*?\）/g, "")
    // 改行3回以上 → 2回に
    .replace(/\n{3,}/g, "\n\n")
    // 文末に改行（。！？のあとにカッコが続かない場合）
    .replace(/([。！？])(?=[^\n」』））])/g, "$1\n")
    // 番号 + 改行 + 本文 → 1行に
    .replace(/(^|\n)(\d+)\.\s*\n([^\n])/g, '$1$2. $3')
    // 番号リスト直後に説明文が続くパターン → 詰める
    .replace(/^(\d+\..+?)\n(?=\S)/gm, '$1\n')
    // 番号リスト前の余分な空行を1行に
    .replace(/\n{2,}(?=\d+\.)/g, '\n\n')
    // 番号リスト内で詰まりすぎているところを調整
    .replace(/(?<=\n\d+\..+?)\n(?=\S)/g, '\n')
    // 行末の空白削除
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function AdminView({ companyId, adminId }) {
  const chatEndRef = useRef(null);           // ✅ チャット最下部へのスクロール用
  const textareaRef = useRef(null);          // ✅ 入力欄の自動拡張用

  // ✅ ここに追加
  useEffect(() => {
    console.log("✅ AdminView mounted");
    }, []);
  // ✅ 入力欄変更時の高さ自動調整処理
const handleInputChange = (e) => {
  const newValue = e.target.value;
  setInput(newValue);

  const textarea = textareaRef.current;
  if (textarea) {
    // ✅ 一旦リセット（これがないとscrollHeightが増え続ける）
    textarea.style.height = "auto";

    // ✅ scrollHeight を取得して高さを再設定
    const newHeight = textarea.scrollHeight;
    textarea.style.height = `${newHeight}px`;
  }
};

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [summary, setSummary] = useState("");
  const [adminBot, setAdminBot] = useState(null);
  const [botPrompt, setBotPrompt] = useState("");
  const [activeTab, setActiveTab] = useState("職員分析");
  const [isLoading, setIsLoading] = useState(false);

  // ✅ モバイル画面切替用（追加ここから）
const [mobileView, setMobileView] = useState("chat");  // "chat", "staff", "analysis"
const [menuOpen, setMenuOpen] = useState(false);
const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
// ✅ return の直前で確認
console.log("📱 mobileView:", mobileView);

useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth <= 768);
  };
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
useEffect(() => {
  console.log("📱 isMobile:", isMobile);
}, [isMobile]);

useEffect(() => {
  console.log("📱 mobileView:", mobileView);
}, [mobileView]);
// ✅ モバイル画面切替用（追加ここまで）

  const llm = new ChatOpenAI({
    modelName: "gpt-4.1",
    temperature: 0.3,
    openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
  });

  // ✅ chatLog が更新されたら最下部へスクロール
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatLog]);

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

  // 自分の発言をチャットに追加
  setChatLog((prev) => [...prev, newMessage]);
  setInput("");

  // Firestoreに保存
  await saveMessageToFirestore({
    companyId,
    employeeId: adminId,
    ...newMessage,
  });

  try {
    // 直近のチャットログ10件を取得
    const recentContext = chatLog
      .slice(-10)
      .map((msg) => `${msg.sender === adminId ? "あなた" : "分身AI"}: ${msg.text}`)
      .join("\n");

    // 類似メッセージを取得
    const similarMessages = await searchSimilarMessages({
      companyId,
      employeeId: adminId,
      queryText: input,
      topK: 5,
      botId: adminBot,
    });

    const similarContext = similarMessages
      .map((msg) => `${msg.sender === adminId ? "あなた" : "分身AI"}: ${msg.text}`)
      .join("\n");

    // 文脈を合成して1500文字以内に調整
    const contextText = (recentContext + "\n" + similarContext).slice(-1500);

    // プロンプトテンプレートの準備
    const prompt = new PromptTemplate({
      inputVariables: ["systemPrompt", "context", "question"],
      template: `
{systemPrompt}

【直前の会話や参考ログ】
{context}

【あなたの入力】
{question}

--- 指示 ---
- 丁寧で自然な日本語で返してください。
- 内容に応じて簡潔または詳細に回答してください。
- （表情）や（動作）は文と同じ行に書き、空行は避けてください。
- ユーザーが何について話しているかを意識し、必要があれば前の流れをくんで回答してください。
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

    // エラー発生時もユーザーに通知
    const errorMessage = {
      sender: adminBot,
      receiver: adminId,
      text: "❌ 応答に失敗しました。しばらくしてからもう一度お試しください。",
      timestamp: new Date().toISOString(),
      botId: adminBot,
    };
    setChatLog((prev) => [...prev, errorMessage]);
  }
};

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setActiveTab("職員分析"); // ✅ ← これを追加することで自己分析の表示を解除
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
以下の1ヶ月分の会話ログをもとに、ユーザーの性格傾向を **Markdown形式で** 出力してください。

# MBTI分析
- **MBTIタイプ**: xxxx（例: INTJ（建築家））
- **MBTI根拠**: 発言や態度に基づく説明を具体的に

# TEG分析
- **TEG数値**:
  - CP（厳格な親）: 0.0〜2.0 の数値
  - NP（養育的な親）: 0.0〜2.0
  - A（大人）: 0.0〜2.0
  - FC（自由な子）: 0.0〜2.0
  - AC（順応する子）: 0.0〜2.0
- **TEGタイプ**: （例：NP優勢型、A安定型、CP優位型 等）
- **特徴**: 長所と短所を挙げてください
- **傾向**: 行動や思考の特徴を簡潔に
- **留意点**: 注意点や改善点を挙げてください

# MBTI × TEG 総評
「現在のあなたの思考は〜です」から始めて以下を含む文章を作成してください：
- 思考スタイル
- 対人関係の傾向
- 強みとストレス傾向
- 相性の良いタイプ（あれば）

## ログ
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
        .map((msg) => `あなた: ${msg.text}`)
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
        .map((msg) => `あなた: ${msg.text}`)
        .join("\n");
  
      if (!feedbackLogs.trim()) {
        setSummary("❌ 1ヶ月分のチャットログが見つかりません。");
        setIsLoading(false);
        return;
      }
  
      const prompt = new PromptTemplate({
        inputVariables: ["log"],
        template: `
  以下の1ヶ月分のあなたの発言ログを元に、次の項目に基づいてフィードバックを作成してください。
  
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
  
console.log("💬 chatLog.length =", chatLog.length);
console.log("💬 chatLog =", chatLog);

return (
  <>
    {/* ✅ モバイル専用：ハンバーガーメニュー */}
    {isMobile && (
      <>
        <div className="mobile-header">
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>≡</button>
          <span className="header-title">Ai-Mine </span>
        </div>

        {menuOpen && (
          <div className="mobile-menu">
            <button onClick={() => { setMobileView("chat"); setMenuOpen(false); }}>マイチャット</button>
            <button onClick={() => { setMobileView("staff"); setMenuOpen(false); }}>職員チャット</button>
            <button onClick={() => { setMobileView("analysis"); setMenuOpen(false); }}>分析</button>
          </div>
        )}
      </>
    )}
    {/* ✅ デスクトップとモバイル共通レイアウト */}
    <div className="admin-container">
      {/* 左：サイドバー */}
      {isMobile ? (
        mobileView === "analysis" && (
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
                <h3>🧠 総評（{
                  activeTab === "職員分析"
                    ? selectedUser?.name ?? "未選択"
                    : "あなた"
                }）</h3>
                <div className="admin-summary-box">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  >
                    {formatReplyText(summary)}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
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
              <h3>🧠 総評（{
                activeTab === "職員分析"
                  ? selectedUser?.name ?? "未選択"
                  : "あなた"
              }）</h3>
              <div className="admin-summary-box">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeHighlight]}
                >
                  {formatReplyText(summary)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

{/* 中央チャット：マイチャット or 分身AI */}
{isMobile ? (
  mobileView === "chat" && (
    <div className="admin-center">
      <h2>分身AIとの壁打ちチャット（{adminBot || "未設定"}）</h2>

      <div className="admin-chat-box">
{chatLog.map((msg, i) => {
  const isAdmin = msg.sender === adminId;
  const wrapperClass = isAdmin
    ? "admin-chat-wrapper admin-chat-right"
    : "admin-chat-wrapper admin-chat-left";
  const senderLabel = isAdmin ? "あなた" : adminBot;

  return (
    <div key={i} className={wrapperClass}>
      <div className="admin-chat-message">
        <div className="chat-sender"><strong>{senderLabel}</strong>:</div>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
        >
          {formatReplyText(msg.text)}
        </ReactMarkdown>
      </div>
    </div>
  );
})}
        <div ref={chatEndRef} />
      </div>

      <div className="admin-input-box">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          placeholder="メッセージを入力..."
          rows={1}
          className="auto-resize-textarea"
        />
        <button onClick={handleAdminSend}>送信</button>
      </div>
    </div>
  )
) : (
  // ✅ デスクトップでは常時表示
  <div className="admin-center">
    <h2>分身AIとの壁打ちチャット（{adminBot || "未設定"}）</h2>

    <div className="admin-chat-box">
{chatLog.map((msg, i) => {
  const isAdmin = msg.sender === adminId;
  const wrapperClass = isAdmin
    ? "admin-chat-wrapper admin-chat-right"
    : "admin-chat-wrapper admin-chat-left";
  const senderLabel = isAdmin ? "あなた" : adminBot;

  return (
    <div key={i} className={wrapperClass}>
      <div className="admin-chat-message">
        <div className="chat-sender"><strong>{senderLabel}</strong>:</div>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
        >
          {formatReplyText(msg.text)}
        </ReactMarkdown>
      </div>
    </div>
  );
})}
      <div ref={chatEndRef} />
    </div>

    <div className="admin-input-box">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        placeholder="メッセージを入力..."
        rows={1}
        className="auto-resize-textarea"
      />
      <button onClick={handleAdminSend}>送信</button>
    </div>
  </div>
)}

      {/* 右：社員ログ・ユーザーリスト */}
      {isMobile ? (
        mobileView === "staff" && (
          <div className="admin-right">
            <h4>📖 社員ログ</h4>
            {selectedUser ? (
              <div className="admin-log-box">
                {messages.length > 0 ? (
                  <div className="admin-chat-box">
                    {messages.map((msg, i) => {
                      const isEmployee = msg.sender === selectedUser.employeeId;
                      const msgClass = isEmployee
                        ? "admin-chat-message admin-chat-right"
                        : "admin-chat-message admin-chat-left";
                      const senderLabel = isEmployee ? selectedUser.name : adminBot;
                      return (
                        <div key={i} className={msgClass}>
                          <div className="chat-sender"><strong>{senderLabel}</strong>:</div>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, rehypeHighlight]}
                          >
                            {formatReplyText(msg.text)}
                          </ReactMarkdown>
                        </div>
                      );
                    })}
                  </div>
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
        )
      ) : (
        <div className="admin-right">
          <h4>📖 社員ログ</h4>
          {selectedUser ? (
            <div className="admin-log-box">
              {messages.length > 0 ? (
                <div className="admin-chat-box">
                  {messages.map((msg, i) => {
                    const isEmployee = msg.sender === selectedUser.employeeId;
                    const msgClass = isEmployee
                      ? "admin-chat-message admin-chat-right"
                      : "admin-chat-message admin-chat-left";
                    const senderLabel = isEmployee ? selectedUser.name : adminBot;
                    return (
                      <div key={i} className={msgClass}>
                        <div className="chat-sender"><strong>{senderLabel}</strong>:</div>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        >
                          {formatReplyText(msg.text)}
                        </ReactMarkdown>
                      </div>
                    );
                  })}
                </div>
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
      )}
    </div>
  </>
);
}

export default AdminView;
