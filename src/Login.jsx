import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import app from "./firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);

function Login({ setUserRole }) {
  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      if (!companyId.trim()) {
        alert("会社IDを入力してください");
        return;
      }

      if (isNewUser) {
        if (password !== confirmPassword) {
          alert("パスワードが一致していません💦");
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, "companies", companyId, "users", uid), {
          email,
          name,
          role: "employee", // デフォルトでは一般職
          companyId,
        });

        alert("登録が完了しました🎉 ログインしてね！");
        setIsNewUser(false);
        setPassword("");
        setConfirmPassword("");
        setName("");
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const docRef = doc(db, "companies", companyId, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserRole(userData.role);

          if (userData.role === "admin") {
            navigate("/admin");
          } else {
            navigate("/employee");
          }
        } else {
          alert("ユーザー情報が見つかりませんでした💦");
        }
      }
    } catch (err) {
      console.error("エラー:", err);
      alert("うまくいかなかったみたい…🥺");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>{isNewUser ? "新規登録" : "ログイン"}</h2>

      <input
        type="text"
        placeholder="会社ID（companyId）"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        style={{ display: "block", marginBottom: "10px", padding: "10px" }}
      />

      {isNewUser && (
        <input
          type="text"
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", marginBottom: "10px", padding: "10px" }}
        />
      )}

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

      {isNewUser && (
        <input
          type="password"
          placeholder="パスワード（確認）"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{ display: "block", marginBottom: "20px", padding: "10px" }}
        />
      )}

      <button
        onClick={handleLogin}
        style={{ padding: "10px 20px", marginBottom: "10px" }}
      >
        {isNewUser ? "登録する✨" : "ログインする"}
      </button>

      <div>
        <small>
          {isNewUser ? "すでにアカウントをお持ちの方は" : "アカウントをお持ちでない方は"}{" "}
          <span
            onClick={() => setIsNewUser(!isNewUser)}
            style={{ color: "#66fcf1", cursor: "pointer", fontWeight: "bold" }}
          >
            こちら
          </span>
        </small>
      </div>
    </div>
  );
}

export default Login;
