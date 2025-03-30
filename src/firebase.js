import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";
import app from "./firebaseConfig";

const db = getFirestore(app);

// 🔹 メッセージ取得（employeeId: "user1" 固定）
export const fetchMessages = async () => {
  const querySnapshot = await getDocs(collection(db, "messages", "user1", "logs"));
  let messages = [];
  querySnapshot.forEach((doc) => {
    messages.push(doc.data());
  });
  return messages;
};

// 🔹 社員IDごとに保存できるように改修済
export const saveMessageToFirestore = async ({ employeeId, sender, receiver, text, timestamp }) => {
  try {
    await addDoc(collection(db, "messages", employeeId, "logs"), {
      sender,
      receiver,
      text,
      timestamp,
    });
    console.log("✅ Firebaseに保存されました");
  } catch (error) {
    console.error("❌ Firebase保存エラー:", error);
  }
};

export { db };
