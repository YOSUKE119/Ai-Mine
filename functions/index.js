const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.registerUsersFromCsv = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError("unauthenticated", "認証が必要です。");
  }

  const { users } = data;

  if (!Array.isArray(users)) {
    throw new functions.https.HttpsError("invalid-argument", "データ形式が不正です。");
  }

  const results = [];

  for (const user of users) {
    const { companyId, companyName, email, name, role } = user;

    if (!companyId || !companyName || !email || !name || !role) {
      results.push({ email, status: "failed", reason: "missing-fields" });
      continue;
    }

    const password = "default1234";
    const prompt = `会社「${companyName}」の管理職「${name}」です。`;

    try {
      // 会社が存在しない場合、追加
      const companyRef = db.collection("companies").doc(companyId);
      const companySnap = await companyRef.get();
      if (!companySnap.exists) {
        await companyRef.set({
          name: companyName,
          createdAt: new Date().toISOString(),
        });
      }

      // ユーザー作成（存在しない場合のみ）
      let uid = null;
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
      } catch (err) {
        // ユーザーが存在しない場合のみ作成
        if (err.code === 'auth/user-not-found') {
          const newUser = await admin.auth().createUser({ email, password });
          uid = newUser.uid;
        } else {
          throw err; // 他のエラーはそのまま上に投げる
        }
      }

      // Firestore にユーザー情報登録
      await db.doc(`companies/${companyId}/users/${uid}`).set({
        email,
        name,
        role,
        companyId,
        mustResetPassword: true,
      });

      // 管理職の場合はBotも追加
      if (role === "admin") {
        await db.doc(`companies/${companyId}/bots/${name}`).set({
          prompt,
        });
      }

      results.push({ email, status: "success" });
    } catch (err) {
      results.push({ email, status: "failed", reason: err.message });
    }
  }

  return { results };
});
