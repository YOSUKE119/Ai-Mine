// src/DevConsole.jsx

import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { db, auth, app } from "./firebaseConfig";

// ✅ LangChainチャット機能を追加
import ChatBox from "./components/ChatBox";

function DevConsole() {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [bots, setBots] = useState({});
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newBotName, setNewBotName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("未ログインです");
        navigate("/");
        return;
      }

      console.log("✅ 現在ログイン中のUID:", user.uid);
      console.log("📦 Firestore プロジェクトID:", app.options.projectId);
      console.log("🔑 APIキー:", app.options.apiKey);

      setUser(user);

      const devRef = doc(db, "developerUsers", user.uid);
      const devDoc = await getDoc(devRef);

      if (!devDoc.exists() || devDoc.data()?.role !== "developer") {
        alert("グローバル開発者ではありません");
        navigate("/");
        return;
      }

      await fetchCompanies();
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchCompanies = async () => {
    try {
      const snap = await getDocs(collection(db, "companies"));
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCompanies(list);
    } catch (err) {
      console.error("会社一覧取得エラー:", err.message);
    }
  };

  useEffect(() => {
    const fetchBots = async () => {
      if (!selectedCompany) return;
      try {
        const snap = await getDocs(collection(db, "companies", selectedCompany, "bots"));
        const botMap = {};
        snap.docs.forEach((doc) => {
          botMap[doc.id] = doc.data();
        });
        setBots(botMap);
      } catch (err) {
        console.error("Bot取得エラー:", err.message);
      }
    };
    fetchBots();
  }, [selectedCompany]);

  const handleAddCompany = async () => {
    if (!newCompanyId.trim() || !newCompanyName.trim()) {
      alert("会社IDと会社名を入力してください");
      return;
    }

    try {
      if (!user) {
        alert("認証ユーザーが見つかりません");
        return;
      }

      await user.getIdToken(true);

      const devRef = doc(db, "developerUsers", user.uid);
      const devDoc = await getDoc(devRef);
      const role = devDoc.data()?.role;

      if (!devDoc.exists() || role !== "developer") {
        alert("グローバル開発者ではありません");
        return;
      }

      const companyRef = doc(db, "companies", newCompanyId.trim());
      const exists = await getDoc(companyRef);
      if (exists.exists()) {
        alert("❌ この会社IDはすでに存在しています");
        return;
      }

      await setDoc(companyRef, {
        name: newCompanyName.trim(),
        createdAt: new Date().toISOString(),
      });

      alert(`✅ 会社「${newCompanyName}」を追加しました`);
      setNewCompanyId("");
      setNewCompanyName("");
      await fetchCompanies();
    } catch (err) {
      console.error("会社追加エラー:", err.code || "", err.message);
      alert("会社の追加に失敗しました。パーミッションまたはネットワークを確認してください。");
    }
  };

  const handleSave = async (botName, prompt) => {
    if (!prompt.trim()) return;
    await setDoc(doc(db, "companies", selectedCompany, "bots", botName), { prompt });
    alert(`✅ 「${botName}」を保存しました`);
  };

  const handleDelete = async (botName) => {
    const confirmDelete = window.confirm(`本当に「${botName}」を削除しますか？`);
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "companies", selectedCompany, "bots", botName));
    const updated = { ...bots };
    delete updated[botName];
    setBots(updated);
  };

  const handleAddBot = async () => {
    const name = newBotName.trim();
    const prompt = newPrompt.trim();
    if (!name || !prompt) return;

    await setDoc(doc(db, "companies", selectedCompany, "bots", name), { prompt });
    setBots((prev) => ({
      ...prev,
      [name]: { prompt },
    }));
    setNewBotName("");
    setNewPrompt("");
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("companyId");
    navigate("/");
  };

  const handleImportCsv = () => {
    if (!csvFile) {
      alert("CSVファイルを選択してください");
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        try {
          for (const row of data) {
            const { companyId, companyName, email, name, role } = row;
            const password = "default1234";

            if (!companyId || !companyName || !email || !name || !role) {
              console.warn("❌ 不正なCSV行:", row);
              continue;
            }

            const companyRef = doc(db, "companies", companyId);
            const companySnap = await getDoc(companyRef);
            if (!companySnap.exists()) {
              await setDoc(companyRef, {
                name: companyName,
                createdAt: new Date().toISOString(),
              });
              await fetchCompanies();
            }

            try {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const uid = userCredential.user.uid;

              await setDoc(doc(db, "companies", companyId, "users", uid), {
                email,
                name,
                role,
                companyId,
                mustResetPassword: true,
              });

              if (role === "admin") {
                const prompt = `会社「${companyName}」の管理職「${name}」です。`;
                await setDoc(doc(db, "companies", companyId, "bots", name), {
                  prompt,
                });
              }

              console.log(`✅ ${email} 登録完了`);
            } catch (err) {
              console.error(`❌ ${email} 登録失敗:`, err.message);
            }
          }

          alert("✅ 社員の一括登録が完了しました！");
        } catch (err) {
          console.error("CSV読み込み中のエラー:", err.message);
          alert("エラーが発生しました。ログを確認してください。");
        }
      },
    });
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1>🛠️ 開発者用コンソール</h1>

      <button onClick={handleLogout} style={{ position: "absolute", top: 20, right: 20 }}>
        ログアウト
      </button>

      <div style={{ marginBottom: 32, background: "#f5f5f5", padding: 20 }}>
        <h2>🏢 新しい会社を登録</h2>
        <input
          placeholder="会社ID（英数字）"
          value={newCompanyId}
          onChange={(e) => setNewCompanyId(e.target.value)}
          style={{ marginRight: 10, padding: 8 }}
        />
        <input
          placeholder="会社名（正式名称）"
          value={newCompanyName}
          onChange={(e) => setNewCompanyName(e.target.value)}
          style={{ marginRight: 10, padding: 8 }}
        />
        <button onClick={handleAddCompany}>会社を追加</button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label><strong>会社を選択：</strong></label>{" "}
        <select
          value={selectedCompany || ""}
          onChange={(e) => setSelectedCompany(e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}（{c.name || "名称未設定"}）
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label><strong>👥 社員CSVを取り込み：</strong></label>{" "}
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files[0])}
          style={{ marginRight: 10 }}
        />
        <button onClick={handleImportCsv}>一括登録</button>
      </div>

      {/* ✅ LangChain ChatBox を表示 */}
      <div style={{ marginBottom: 32 }}>
        <h2>🧠 ChatBot (OpenAI + LangChain)</h2>
        <ChatBox />
      </div>

      {selectedCompany && (
        <>
          <h2>🤖 {selectedCompany} の Bot一覧</h2>
          {Object.entries(bots).map(([name, data]) => (
            <div key={name} style={{ marginBottom: 16 }}>
              <strong>{name}</strong>
              <br />
              <textarea
                value={data.prompt}
                onChange={(e) =>
                  setBots((prev) => ({
                    ...prev,
                    [name]: { prompt: e.target.value },
                  }))
                }
                rows={4}
                style={{ width: "100%", marginBottom: 4 }}
              />
              <button onClick={() => handleSave(name, bots[name].prompt)}>保存</button>
              <button
                onClick={() => handleDelete(name)}
                style={{ marginLeft: 8, color: "red" }}
              >
                削除
              </button>
            </div>
          ))}

          <h3>➕ 新しいBotを追加</h3>
          <input
            type="text"
            placeholder="Bot名"
            value={newBotName}
            onChange={(e) => setNewBotName(e.target.value)}
            style={{ width: "50%", marginBottom: 8 }}
          />
          <br />
          <textarea
            placeholder="プロンプト内容"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={4}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <br />
          <button onClick={handleAddBot}>➕ 追加</button>
        </>
      )}
    </div>
  );
}

export default DevConsole;
