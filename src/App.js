// App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminView from "./AdminView";
import EmployeeDashboard from "./EmployeeDashboard"; // ✅ 追加した社員専用ページ
import Login from "./Login";
import ProtectedRoute from "./ProtectedRoute";

function App() {
  const [userRole, setUserRole] = useState(null); // 🔐 ロールを保持

  return (
    <Router>
      <Routes>
        {/* 🌟 ログイン画面 */}
        <Route path="/" element={<Login setUserRole={setUserRole} />} />

        {/* 👩‍💼 社員専用ダッシュボード */}
        <Route path="/employee" element={<EmployeeDashboard />} />

        {/* 💼 管理者のみアクセスOK */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={userRole} allowedRole="admin">
              <AdminView />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
