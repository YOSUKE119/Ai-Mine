import './App.css';
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import app from "./firebaseConfig";

import AdminView from "./AdminView";
import EmployeeDashboard from "./EmployeeDashboard";
import Login from "./Login";
import ProtectedRoute from "./ProtectedRoute";
import DevConsole from "./DevConsole"; // ✅ 開発者ページ

function App() {
  const [userRole, setUserRole] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid;
        setUid(uid);

        const savedCompanyId = localStorage.getItem("companyId");
        if (!savedCompanyId) {
          console.error("❌ companyId が localStorage に存在しません");
          setLoading(false);
          return;
        }

        const userRef = doc(db, "companies", savedCompanyId, "users", uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCompanyId(savedCompanyId);
          setUserRole(userData.role);
        } else {
          console.error("❌ Firestore にユーザードキュメントが見つかりません");
        }
      } else {
        setUid(null);
        setCompanyId(null);
        setUserRole(null);
      }

      setLoading(false);
    });
  }, []);

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* 🔐 ログイン */}
          <Route path="/" element={<Login setUserRole={setUserRole} />} />

          {/* 👤 一般社員 */}
          <Route
            path="/employee"
            element={
              <EmployeeDashboard
                companyId={companyId}
                employeeId={uid}
              />
            }
          />

          {/* 👨‍💼 管理職 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role={userRole} allowedRole="admin">
                <AdminView companyId={companyId} adminId={uid} />
              </ProtectedRoute>
            }
          />

          {/* 🛠️ 開発者 */}
          <Route
            path="/dev"
            element={
              <ProtectedRoute role={userRole} allowedRole="developer">
                <DevConsole />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
