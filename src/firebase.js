import { getFirestore, collection, getDocs } from "firebase/firestore";
import app from "./firebaseConfig"; // 設定したFirebaseをインポート

const db = getFirestore(app); // Firestoreのデータベースを取得

export const fetchMessages = async () => {
  const querySnapshot = await getDocs(collection(db, "messages", "user1", "logs"));
  let messages = [];
  querySnapshot.forEach((doc) => {
    messages.push(doc.data());
  });
  return messages;
};
export { db };