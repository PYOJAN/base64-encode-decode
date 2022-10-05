import { useState } from "react";
// import logo from "./assets/logo.png";
import Navbar from "./Navbar/Navbar";

import "./App.scss";

import B64ToPdf from "./pages/B64ToPdf/B64ToPdf";
import B64ToText from "./pages/B64ToText/B64ToText";
import PdfToB64 from "./pages/PdfToB64/PdfToB64";
import TextToB64 from "./pages/TextToB64/TextToB64";

const pages = {
  1: PdfToB64,
  2: B64ToPdf,
  3: TextToB64,
  4: B64ToText,
};

function App() {
  const [page, setPage] = useState(1);

  const Page = pages[page];

  return (
    <div className="app">
      <div className="navbar__left">
        <div className="brand">
          <img src="logo.png" alt="brand" />
          <span>Dev Tool</span>
        </div>

        <Navbar onPageChange={setPage} />
      </div>

      <div className="main__body">
        <Page />
      </div>
    </div>
  );
}

export default App;
