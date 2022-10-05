import React, { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "./PdfViewer.scss";
// import pdfWorker from "./pdf.worker";

// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;
pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

console.log(pdfjs.version);

const PdfViewer = ({ pdfBase64, onError = (isError) => {} }) => {
  const [pdfInfo, setPdfInfo] = useState("");

  const handlePdfOnLoad = (state) => {
    const pages = state._pdfInfo.numPages;
    setPdfInfo(pages);

    console.log(state);
  };

  const onClikHandle = (e) => {
    console.log(pdfInfo);
  };

  return (
    <>
      <Document
        file={`data:application/pdf;base64,${pdfBase64}`}
        onContextMenu={(e) => e.preventDefault()}
        className="pdf-container"
        onLoadSuccess={handlePdfOnLoad}
        onLoadError={onError}
      >
        {Array.from({ length: pdfInfo }, (_, i) => i + 1).map((page) => (
          <Page
            key={page}
            pageNumber={page}
            onClick={onClikHandle}
            scale={1.3}
            height={750}
          />
        ))}
      </Document>
    </>
  );
};
export default PdfViewer;
