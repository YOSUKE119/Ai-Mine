// firebase.js（LangChain v0.3.23 対応）

import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  setDoc,
  doc,
  where,
} from "firebase/firestore";

import { db, auth } from "./firebaseConfig";
import { OpenAIEmbeddings } from "@langchain/openai";
import { cosineSimilarity } from "./utils";

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
 * 🔹 メッセージ保存（＋ベクトルも保存）（botIdも保存）
 */
export const saveMessageToFirestore = async ({
  companyId,
  employeeId,
  sender,
  receiver,
  text,
  timestamp,
  botId,
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
      botId, // 🧠 メッセージにもbotId保存！
    });

    // ベクトル保存
    const vectorRef = doc(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "vectors",
      timestamp
    );

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
    });
    const result = await embeddings.embedQuery(text);

    await setDoc(vectorRef, {
      vector: result,
      text,
      botId, // 🧠 ベクトルにもbotId保存！
      createdAt: new Date().toISOString(),
    });

    console.log("✅ メッセージ＆ベクトル保存完了");
  } catch (error) {
    console.error("❌ 保存エラー:", error.code || error.message);
  }
};

/**
 * 🔹 類似メッセージ検索（RAG用）（botIdフィルタ付き）
 */
export const searchSimilarMessages = async ({ companyId, employeeId, queryText, topK = 3, botId }) => {
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.REACT_APP_OPENAI_API_KEY,
    });
    const queryVector = await embeddings.embedQuery(queryText);

    const vectorsRef = collection(
      db,
      "companies",
      companyId,
      "users",
      employeeId,
      "vectors"
    );

    const q = query(vectorsRef, where("botId", "==", botId)); // 🧠 botIdで絞る
    const snapshot = await getDocs(q);

    const results = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const similarity = cosineSimilarity(queryVector, data.vector);
      return {
        text: data.text,
        score: similarity,
      };
    });

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  } catch (err) {
    console.error("❌ 類似検索エラー:", err);
    return [];
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
    console.error("❌ Bot一覧取得エラー:", error.code, error.message);
    return {};
  }
};

/**
 * 🔹 会社登録
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

    console.log("✅ 会社登録成功");
  } catch (err) {
    console.error("❌ 会社登録エラー:", err.code, err.message);
    throw err;
  }
};
