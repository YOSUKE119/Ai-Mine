import React from "react";
import UserList from "./UserList";

function UserList({ users, onSelectUser }) {
  return (
    <div style={{ padding: "10px", borderRight: "1px solid #ccc" }}>
      <h3>ユーザー一覧</h3>
      {users.map((user) => (
        <div
          key={user}
          style={{
            marginBottom: "8px",
            cursor: "pointer",
            padding: "5px",
            borderRadius: "5px",
            background: "#f0f0f0",
          }}
          onClick={() => onSelectUser(user)}
        >
          {user}
        </div>
      ))}
    </div>
  );
}

export default UserList;
