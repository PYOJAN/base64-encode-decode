import React, { useState } from "react";
import TextArea from "../../components/TextArea/TextArea";

import "./pdfToB64.scss";

import FilePicker from "../../components/FilePicker/FilePicker";

const PdfToB64 = () => {
  const [B64, setB64] = useState("");
  return (
    <>
      <FilePicker
        title="Select PDF file to convert B64"
        acceptType={["pdf"]}
        onLoadSuccess={(e) => setB64(e)}
      />

      <TextArea
        placeholder="Result........."
        value={B64}
        className="pdf-base64-result"
      />
    </>
  );
};

export default PdfToB64;
