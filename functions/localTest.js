const axios = require("axios");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

// Firebase Web SDK 設定（Client SDK 用）
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "ai-mine-8cd9c.firebaseapp.com",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const test = async () => {
  const mockUserList = [
    {
      companyId: "test-company",
      companyName: "テストカンパニー",
      email: "admin@example.com",
      name: "管理職A",
      role: "admin",
    },
    {
      companyId: "test-company",
      companyName: "テストカンパニー",
      email: "employee@example.com",
      name: "社員B",
      role: "employee",
    },
  ];

  try {
    // ✅ 認証（Firebase Authentication でサインイン）
    const userCredential = await signInWithEmailAndPassword(
      auth,
      "dev@example.com",  // ← 実際に存在するユーザー
      "password123"         // ← 初期パスワード
    );
    const idToken = await userCredential.user.getIdToken();

    // ✅ 認証トークンを付与して関数呼び出し
    const response = await axios.post(
      "http://localhost:5001/ai-mine-8cd9c/us-central1/registerUsersFromCsv",
      { users: mockUserList },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // 🔑 これが重要！
        },
      }
    );

    console.log("✅ 登録結果:", response.data);
  } catch (err) {
    console.error("🔥 呼び出し失敗:", err.message);
    console.error(err.response?.data || err);
  }
};

test();
