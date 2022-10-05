import React, { useRef, useState } from "react";
import PdfViewer from "../../components/PdfViewer/PdfViewer";
import TextArea from "../../components/TextArea/TextArea";
import Button from "../../components/Button/Button";

import "./b64ToPdf.scss";

const B64ToPdf = () => {
  const [value, setValue] = useState("");
  const [err, setError] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const downloadPdfRef = useRef(null);

  const handelDataSet = async (data, isClipBoard) => {
    try {
      const textData = isClipBoard
        ? await navigator.clipboard.readText()
        : data;
      setValue(decodeURIComponent(textData));
    } catch (err) {
      alert("unable to process, PLEASE TRY AGAIN...");
    }
  };

  const handleShowPdf = () => {
    try {
      if (btoa(atob(value)) === value) {
        setShowPdf(true);
      } else {
        throw Error("Invalid Base64 Data");
      }
    } catch (error) {
      errorHandle(error);
    }
  };

  const errorHandle = (error) => {
    setError(true);
    alert("Unable to decode, Invalid PDF base64.");
    console.log(error);
  };

  return (
    <>
      <TextArea
        isDisabled={false}
        className="text-field"
        onChange={(e) => handelDataSet(e.target.value, false)}
        value={value}
        placeholder="Enter base64 encoded data to convert into PDF."
      />

      {value ? (
        <div className="button-group">
          <button
            className="btn-decode"
            onClick={() => {
              setValue("");
              setShowPdf(false);
            }}
          >
            Clear
          </button>
          <button className="btn-clear" onClick={handleShowPdf}>
            {showPdf ? "Showing..." : "Decode PDF"}
          </button>
        </div>
      ) : (
        <button className="btn-paste" onClick={() => handelDataSet(null, true)}>
          <img src="paste.png" alt="" /> Click to paste Here
        </button>
      )}

      {/* Overlayer to show PDF */}
      {showPdf && (
        <div className="pdfDisOverlayer">
          <Button
            className="closePdfDis"
            onClick={() => {
              setShowPdf(false);
              setError(false);
            }}
          >
            <img src="close.png" alt="icon" /> Close
          </Button>
          {!err && (
            <Button
              className="download-btn"
              onClick={() => downloadPdfRef.current.click()}
            >
              <img src="download.png" alt="icon" />
              Download
            </Button>
          )}
          <a
            download="Decoded-pdf.pdf"
            href={`data:application/pdf;base64,${value}`}
            ref={downloadPdfRef}
          ></a>
          <PdfViewer pdfBase64={value} onError={errorHandle} />
        </div>
      )}
    </>
  );
};

export default B64ToPdf;
