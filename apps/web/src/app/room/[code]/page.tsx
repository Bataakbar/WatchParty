"use client";

import { useEffect, useState } from "react";
import RoomClient from "@/components/room/room-client";

export default function RoomPage() {
  const [username, setUsername] = useState("");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time storage bootstrap
      setUsername(sessionStorage.getItem("wt:username") || "Guest");
    } catch {
       
      setUsername("Guest");
    }
  }, []);

  if (!username) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted">
        Entering room…
      </div>
    );
  }

  return <RoomClient username={username} />;
}
