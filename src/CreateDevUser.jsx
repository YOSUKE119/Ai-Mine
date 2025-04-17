// src/CreateDevUser.jsx
import React, { useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

function CreateDevUser() {
  useEffect(() => {
    const createUser = async () => {
      try {
        const email = "dev@example.com";
        const password = "password123"; // ← 実際に dev-login で使うパスワード
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        await setDoc(doc(db, "developerUsers", uid), {
          email,
          role: "developer",
        });

        alert("✅ 開発者アカウント作成完了！");
      } catch (err) {
        alert(`❌ エラー: ${err.code} - ${err.message}`);
        console.error(err);
      }
    };

    createUser();
  }, []);

  return <div>開発者アカウントを作成中...</div>;
}

export default CreateDevUser;
