// src/DevConsole.jsx
import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import app from "./firebaseConfig";

const db = getFirestore(app);

function DevConsole() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [bots, setBots] = useState({});
  const [newBotName, setNewBotName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  // 🔹 会社一覧を取得
  useEffect(() => {
    const fetchCompanies = async () => {
      const snap = await getDocs(collection(db, "companies"));
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCompanies(list);
    };
    fetchCompanies();
  }, []);

  // 🔹 選択中の会社のBotを取得
  useEffect(() => {
    const fetchBots = async () => {
      if (!selectedCompany) return;
      const snap = await getDocs(
        collection(db, "companies", selectedCompany, "bots")
      );
      const botMap = {};
      snap.docs.forEach((doc) => {
        botMap[doc.id] = doc.data();
      });
      setBots(botMap);
    };
    fetchBots();
  }, [selectedCompany]);

  // 🔹 Bot保存
  const handleSave = async (botName, prompt) => {
    if (!prompt.trim()) return;
    await setDoc(doc(db, "companies", selectedCompany, "bots", botName), {
      prompt,
    });
    alert(`✅ 「${botName}」を保存しました`);
  };

  // 🔹 Bot削除
  const handleDelete = async (botName) => {
    const confirmDelete = window.confirm(`本当に「${botName}」を削除しますか？`);
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "companies", selectedCompany, "bots", botName));
    const updated = { ...bots };
    delete updated[botName];
    setBots(updated);
  };

  // 🔹 新しいBot追加
  const handleAdd = async () => {
    const name = newBotName.trim();
    const prompt = newPrompt.trim();
    if (!name || !prompt) return;

    await setDoc(doc(db, "companies", selectedCompany, "bots", name), {
      prompt,
    });
    setBots((prev) => ({
      ...prev,
      [name]: { prompt },
    }));
    setNewBotName("");
    setNewPrompt("");
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1>🛠️ 開発者用コンソール</h1>

      {/* 会社選択 */}
      <div style={{ marginBottom: 24 }}>
        <label><strong>会社を選択：</strong></label>{" "}
        <select
          value={selectedCompany || ""}
          onChange={(e) => setSelectedCompany(e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
      </div>

      {/* Bot一覧編集 */}
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
              <button onClick={() => handleSave(name, bots[name].prompt)}>
                保存
              </button>
              <button
                onClick={() => handleDelete(name)}
                style={{ marginLeft: 8, color: "red" }}
              >
                削除
              </button>
            </div>
          ))}

          {/* Bot新規追加 */}
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
          <button onClick={handleAdd}>➕ 追加</button>
        </>
      )}
    </div>
  );
}

export default DevConsole;
