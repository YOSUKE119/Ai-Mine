// src/firebase.js

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
import app from "./firebaseConfig";

const db = getFirestore(app);

/**
 * 🔹 メッセージ取得（社員ごと・会社ごと）
 * 🔸 timestamp 昇順（古い → 新しい）で並び替え済み
 */
export const fetchMessages = async (companyId, employeeId) => {
  try {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "messages"
    );

    const q = query(messagesRef, orderBy("timestamp", "asc")); // ✅ 昇順で取得
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("❌ メッセージ取得エラー:", error);
    return [];
  }
};

/**
 * 🔹 メッセージ保存（社員ごと・会社ごと）
 */
export const saveMessageToFirestore = async ({
  companyId,
  employeeId,
  sender,
  receiver,
  text,
  timestamp,
}) => {
  try {
    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "messages"
    );

    await addDoc(messagesRef, { sender, receiver, text, timestamp });
    console.log("✅ Firebaseに保存されました");
  } catch (error) {
    console.error("❌ Firebase保存エラー:", error);
  }
};

/**
 * 🔹 Bot一覧を取得（会社ごと）
 */
export const fetchCompanyBots = async (companyId) => {
  try {
    const botsRef = collection(db, "companies", companyId, "bots");
    const snapshot = await getDocs(botsRef);

    const bots = {};
    snapshot.forEach((doc) => {
      bots[doc.id] = doc.data(); // 例: { 佐藤社長: { prompt: "..."} }
    });

    return bots;
  } catch (error) {
    console.error("❌ Bot一覧の取得エラー:", error);
    return {};
  }
};

// 🔸 Firestoreインスタンスも必要なら個別エクスポート
export { db };
