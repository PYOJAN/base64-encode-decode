import React, { useEffect, useState } from "react";
import TextArea from "../../components/TextArea/TextArea";
import Button from "../../components/Button/Button";

import "./b64ToText.scss";

import { isBase64 } from "../../utils/fileReader";

const B64ToText = () => {
  const [B64, setB64] = useState("");
  const [plainText, setPlaintText] = useState("");
  const [copyData, setCopyData] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const isB64 = isBase64(B64);
      if (isB64) {
        setPlaintText(atob(B64));
      }
      if (B64 && !isB64) {
        alert("Unable to decode: Invaild Base64 data.");
        // setB64("");
      }
    }, 1000 * 0.5);

    return () => clearTimeout(timer);
  }, [B64]);

  const handleSetData = async (data) => {
    try {
      const rawValue = !data ? await navigator.clipboard.readText() : data;
      setB64(decodeURIComponent(rawValue));
    } catch (err) {
      alert("Operation failed, PLEASE TRY AGAIN");
      console.log(err.message);
    }
  };

  const handleCopy = () => {
    try {
      setCopyData(true);
      navigator.clipboard.writeText(plainText);
    } catch (err) {
      alert("Operation failed, PLEASE TRY AGAIN");
      console.log(err.message);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setCopyData(false);
    }, 1000 * 0.8);

    return () => clearTimeout(timer);
  }, [copyData]);

  const handleClear = () => {
    setB64("");
    // setCopyData(false);
    // setPlaintText("");
  };

  return (
    <>
      <div className="b64__textarea">
        <TextArea
          isDisabled={false}
          placeholder="Enter here B64 to decode into Text...."
          value={B64}
          onChange={(e) => handleSetData(e.target.value)}
        >
          {!B64 && (
            <div className="btn__paste__wrapper">
              <Button
                className="paste__btn"
                onClick={() => handleSetData(null)}
              >
                <img src="paste.png" alt="Icon" />
                paste
              </Button>
            </div>
          )}
        </TextArea>
      </div>

      {plainText && (
        <div className="btn__Wrapper">
          <TextArea className="plain__textarea" value={plainText}>
            <span className="divider" data-message="Result"></span>

            <div className="btn__wrapper">
              {/* Clear Button */}
              {B64 && (
                <Button className="clearBtn" onClick={handleClear}>
                  Clear Base64
                </Button>
              )}
              {/* Copy button */}
              <Button className="btn__copy" onClick={handleCopy}>
                <img src={!copyData ? "copy.png" : "check.png"} alt="Icon" />
                {!copyData ? "Copy Decoded Data" : "Copied"}
              </Button>
            </div>
          </TextArea>
        </div>
      )}
    </>
  );
};

export default B64ToText;
