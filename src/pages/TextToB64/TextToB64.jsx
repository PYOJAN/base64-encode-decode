import React, { useEffect, useState } from "react";
import FilePicker from "../../components/FilePicker/FilePicker";
import TextArea from "../../components/TextArea/TextArea";
import Buttons from "../../components/Buttons/Buttons";

import "./textToB64.scss";
import Button from "../../components/Button/Button";

const TextToB64 = () => {
  const [B64, setB64] = useState("");
  const [textContent, setTextContent] = useState({
    isFile: false,
    textData: "",
  });

  const handleOnFileLoad = (base64Data) => {
    setB64(base64Data);
    setTextContent({ ...textContent, isFile: true });
  };

  const handleOnTextFieldChange = (e) => {
    const text = e.target.value;
    setTextContent({ isFile: false, textData: text });

    if (text.length <= 1) {
      setB64("");
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        textContent.textData && setB64(btoa(textContent.textData));
      } catch (err) {
        alert("Unable to Encode into Base64");
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [textContent.textData]);

  const handleClearTextField = (e) => {
    setB64("");
    setTextContent({ isFile: false, textData: "" });
  };

  const handlePaste = async () => {
    try {
      const copyData = await navigator.clipboard.readText();
      setTextContent({
        ...textContent,
        textData: copyData,
      });
    } catch (err) {
      alert("Unable to paste here, Please try again..");
    }
  };

  return (
    <>
      <div className="text-data">
        {!textContent.textData && (
          <FilePicker
            acceptType={["text", "xml", "json"]}
            title="Select TEXT, XML or JOSN file to convert into Base64"
            onLoadSuccess={handleOnFileLoad}
          >
            {B64 && (
              <Button
                className="clearFileSelection"
                onClick={handleClearTextField}
              >
                Clear
              </Button>
            )}
          </FilePicker>
        )}

        <div className="wrapper">
          {!textContent.isFile && (
            <TextArea
              value={textContent.textData}
              placeholder="Enter Your Text here to convert into base64."
              isDisabled={false}
              onChange={handleOnTextFieldChange}
              className="textField"
            >
              {!textContent.textData && (
                <span className="divider" data-message="OR"></span>
              )}
              {B64 && (
                <button
                  className="clearTextFeild"
                  onClick={handleClearTextField}
                >
                  Clear
                </button>
              )}

              {!textContent.textData && (
                <Button className="paste-content" onClick={handlePaste}>
                  <img src="paste.png" alt="" />
                  click to paste here...
                </Button>
              )}
            </TextArea>
          )}
          {(textContent.textData || B64) && (
            <TextArea
              value={B64}
              className="textFiled b64Result"
              placeholder="Base64 Result here............"
            >
              <span className="divider" data-message="Result"></span>
              {!textContent.isFile && B64 && (
                <div className="btn_wrapper">
                  <Buttons data={B64} />
                </div>
              )}
            </TextArea>
          )}
        </div>
      </div>
    </>
  );
};

export default TextToB64;
