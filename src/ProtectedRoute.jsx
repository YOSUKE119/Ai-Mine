// ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ role, allowedRole, children }) {
  if (role !== allowedRole) {
    alert("🚫 アクセス権限がありません！");
    return <Navigate to="/" />;
  }
  return children;
}

export default ProtectedRoute; // ←これが必要！！
