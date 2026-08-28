import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface Status {
  appTabs: number[];
  siteTabId: number | null;
}

function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

function Popup() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res) setStatus(res as Status);
    });
  }, []);

  return (
    <div>
      <h1>
        Watch<span style={{ color: "#22d3ee" }}>Together</span> Bridge
      </h1>
      <div className="row">
        <Dot color={status && status.appTabs.length > 0 ? "#34d399" : "#a1a1aa"} />
        Watch party tab: {status && status.appTabs.length > 0 ? "connected" : "not open"}
      </div>
      <div className="row">
        <Dot color={status?.siteTabId ? "#22d3ee" : "#a1a1aa"} />
        Supported site tab: {status?.siteTabId ? "linked" : "none"}
      </div>
      <div className="row" style={{ fontSize: 11, color: "#71717a" }}>
        Open a room at localhost:3000 to begin.
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
