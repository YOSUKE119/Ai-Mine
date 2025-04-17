import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebaseConfig"; // ✅ appではなくauth, dbを直接import

function DeveloperLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const devDocRef = doc(db, "developerUsers", uid);
      const devDocSnap = await getDoc(devDocRef);

      if (!devDocSnap.exists()) {
        alert("開発者アカウントではありません");
        return;
      }

      const role = devDocSnap.data()?.role;
      if (role !== "developer") {
        alert("アクセス権限がありません");
        return;
      }

      navigate("/dev");
    } catch (error) {
      console.error("ログインエラー:", error.message);
      alert("ログインに失敗しました");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>🧑‍💻 開発者ログイン</h2>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10, padding: 10 }}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 20, padding: 10 }}
      />
      <button onClick={handleLogin} style={{ padding: "10px 20px" }}>
        ログイン
      </button>
    </div>
  );
}

export default DeveloperLogin;
