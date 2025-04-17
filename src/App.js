import './App.css';
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

// 各画面
import AdminView from "./AdminView";
import EmployeeDashboard from "./EmployeeDashboard";
import Login from "./Login";
import ProtectedRoute from "./ProtectedRoute";
import DevConsole from "./DevConsole";
import DeveloperLogin from "./DeveloperLogin";

// ✅ 一時的に開発者ユーザーを作成するコンポーネント
import CreateDevUser from "./CreateDevUser";

function App() {
  const [userRole, setUserRole] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setCompanyId(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      const uid = user.uid;
      setUid(uid);

      // ✅ グローバル開発者の確認
      const devRef = doc(db, "developerUsers", uid);
      const devSnap = await getDoc(devRef);
      if (devSnap.exists()) {
        setUserRole("developer");
        setCompanyId(null);
        setLoading(false);
        return;
      }

      // 🔸 開発者でなければ会社所属ユーザーとして確認
      const savedCompanyId = localStorage.getItem("companyId");
      if (!savedCompanyId) {
        console.error("❌ companyId が localStorage に存在しません");
        setLoading(false);
        return;
      }

      const userRef = doc(db, "companies", savedCompanyId, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const role = userSnap.data().role;
        setUserRole(role);
        setCompanyId(savedCompanyId);
      } else {
        console.error("❌ Firestore にユーザードキュメントが見つかりません");
      }

      setLoading(false);
    });
  }, []);

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Login setUserRole={setUserRole} />} />
          <Route path="/dev-login" element={<DeveloperLogin />} />
          <Route
            path="/employee"
            element={<EmployeeDashboard companyId={companyId} employeeId={uid} />}
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role={userRole} allowedRole="admin">
                <AdminView companyId={companyId} adminId={uid} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dev"
            element={
              <ProtectedRoute role={userRole} allowedRole="developer">
                <DevConsole />
              </ProtectedRoute>
            }
          />
          {/* ✅ 開発用：一時的なルート */}
          <Route path="/create-dev" element={<CreateDevUser />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
