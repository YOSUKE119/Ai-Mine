// firebase.js
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  setDoc,
  doc
} from "firebase/firestore";

import { db, auth } from "./firebaseConfig";

/**
 * 🔹 メッセージ取得（社員ごと・会社ごと）
 */
export const fetchMessages = async (companyId, employeeId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("未認証ユーザーです");

    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "messages"
    );

    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("❌ メッセージ取得エラー:", error.code, error.message);
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
    const user = auth.currentUser;
    if (!user) throw new Error("未認証ユーザーです");

    const messagesRef = collection(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "messages"
    );

    await addDoc(messagesRef, {
      sender,
      receiver,
      text,
      timestamp,
    });

    console.log("✅ Firebaseに保存されました");
  } catch (error) {
    console.error("❌ Firebase保存エラー:", error.code, error.message);
  }
};

/**
 * 🔹 Bot一覧取得
 */
export const fetchCompanyBots = async (companyId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("未認証ユーザーです");

    const botsRef = collection(db, "companies", companyId, "bots");
    const snapshot = await getDocs(botsRef);

    const bots = {};
    snapshot.forEach((doc) => {
      bots[doc.id] = doc.data();
    });

    return bots;
  } catch (error) {
    console.error("❌ Bot一覧の取得エラー:", error.code, error.message);
    return {};
  }
};

/**
 * 🔹 会社追加
 */
export const addCompany = async (companyId, companyName) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("未認証ユーザーです");

    const companyRef = doc(db, "companies", companyId);
    await setDoc(companyRef, {
      name: companyName,
      createdAt: new Date().toISOString(),
    });

    console.log("✅ 会社追加成功");
  } catch (err) {
    console.error("❌ 会社追加エラー:", err.code, err.message);
    throw err;
  }
};
