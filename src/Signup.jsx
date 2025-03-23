import React, { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import app from "./firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);

function Signup() {
  const [name, setName] = useState(""); // ← 名前の状態を追加✨
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const navigate = useNavigate();

  const handleSignup = async () => {
    if (password !== confirm) {
      alert("パスワードが一致しません💦");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 🎉 Firestoreに名前も保存✨
      await setDoc(doc(db, "users", uid), {
        name,
        email,
        role: "employee"
      });

      alert("登録完了！ログインしてね✨");
      navigate("/login");
    } catch (err) {
      console.error("登録失敗:", err);
      alert("登録に失敗しちゃった…🥺");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>新規登録</h2>

      <input
        type="text"
        placeholder="名前"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", marginBottom: "10px", padding: "10px" }}
      />

      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: "10px", padding: "10px" }}
      />

      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: "10px", padding: "10px" }}
      />

      <input
        type="password"
        placeholder="パスワード確認"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        style={{ display: "block", marginBottom: "20px", padding: "10px" }}
      />

      <button onClick={handleSignup} style={{ padding: "10px 20px" }}>
        登録する✨
      </button>
    </div>
  );
}

export default Signup;
