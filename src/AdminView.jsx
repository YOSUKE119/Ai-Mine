import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { fetchMessages } from "./firebase";
import app from "./firebaseConfig";

const db = getFirestore(app);

function AdminView() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);

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
            email: data.email
          });
        }
      });
      setUsers(employeeUsers);
    };
    load();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      
      {/* 左：プロフィール＆総評 */}
      <div style={{ width: "25%", background: "#0b0c10", color: "white", padding: "20px" }}>
        <div style={{ textAlign: "center" }}>
          <img src="/logo.png" alt="Ai-Mine Logo" style={{ width: "120px", marginBottom: "20px" }} />
          <h2>佐藤社長</h2>
        </div>
        <div style={{ background: "#1f2833", borderRadius: "8px", padding: "15px", marginTop: "20px" }}>
          <h4>📊 AI分析総評</h4>
          <p>🧠 社員のモチベ傾向：安定</p>
          <p>💬 コミュニケーション：対話型が増加中</p>
        </div>
      </div>

      {/* 中央：壁打ち */}
      <div style={{ width: "40%", padding: "20px", background: "#f0f0f0" }}>
        <h2>分身AIとの壁打ちチャット（YOSUKE）</h2>
        <div
          style={{
            height: "70vh",
            background: "#fff",
            borderRadius: "8px",
            padding: "10px",
            overflowY: "auto"
          }}
        >
          <p>※ChatGPTとの接続はまだオフ</p>
        </div>
      </div>

      {/* 右：ログ＋社員リスト */}
      <div style={{ width: "35%", padding: "20px", background: "#c5c6c7", display: "flex", flexDirection: "column" }}>
        <h2 style={{ color: "#0b0c10" }}>
          {selectedUser ? `📖 ${selectedUser.name}のログ表示` : "← 社員を選んでね"}
        </h2>

        <div style={{ flex: 1, background: "#fff", borderRadius: "10px", padding: "15px", overflowY: "auto", marginBottom: "20px" }}>
          {selectedUser ? (
            messages
              .filter(msg => msg.sender === selectedUser.email || msg.receiver === selectedUser.email)
              .map((msg, i) => (
                <div key={i} style={{ marginBottom: "10px", color: "#000" }}>
                  <strong>{msg.sender}</strong>: {msg.text}
                </div>
              ))
          ) : (
            <p style={{ color: "#555" }}>ログを見るには社員を選んでね😊</p>
          )}
        </div>

        <div
          style={{
            background: "#1f2833",
            borderRadius: "10px",
            padding: "10px",
            color: "#fff",
            maxHeight: "180px",
            overflowY: "auto"
          }}
        >
          <h4>👥 社員リスト</h4>
          {users.map((user) => (
            <div
              key={user.email}
              onClick={() => setSelectedUser(user)}
              style={{
                padding: "8px",
                backgroundColor: selectedUser?.email === user.email ? "#66fcf1" : "#45a29e",
                marginBottom: "8px",
                borderRadius: "6px",
                cursor: "pointer",
                color: "#0b0c10",
                fontWeight: "bold",
                textAlign: "center"
              }}
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
