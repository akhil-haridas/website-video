import React from "react";
import "./App.css";
import { WebHtml, WebVideo } from "./components";

function App() {
  return (
    <div className="viewerWrapper">
      {/* <WebVideo /> */}
      <WebHtml />
    </div>
  );
}

export default App;
