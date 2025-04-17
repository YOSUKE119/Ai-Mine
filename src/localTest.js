const { getApps, initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFunctions } = require("firebase-admin/functions");
const { getAuth } = require("firebase-admin/auth");

// 初期化
if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
  });
}

const test = async () => {
  const auth = getAuth();
  const functions = getFunctions();
  const callFunction = functions.httpsCallable("registerUsersFromCsv");

  const mockUserList = [
    {
      companyId: "test-company",
      companyName: "テストカンパニー",
      email: "admin@example.com",
      name: "佐藤",
      role: "admin",
    },
    {
      companyId: "test-company",
      companyName: "テストカンパニー",
      email: "employee@example.com",
      name: "田中",
      role: "employee",
    },
  ];

  try {
    const result = await callFunction({ users: mockUserList });
    console.log("📦 結果:", JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error("❌ 関数エラー:", err.message);
  }
};

test();
