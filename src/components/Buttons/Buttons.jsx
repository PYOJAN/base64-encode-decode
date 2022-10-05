import React, { useState, useEffect } from "react";
import Button from "../Button/Button";

import "./buttons.scss";

const COPY_TYPE = {
  B64: "B64",
  URL: "URL",
};

const Buttons = ({ data }) => {
  const [copy, setCopy] = useState("");

  const handleOnclick = (type) => {
    setCopy(type);
    type === COPY_TYPE.B64
      ? navigator.clipboard.writeText(data)
      : navigator.clipboard.writeText(encodeURIComponent(data));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCopy("");
    }, 1000 * 2);

    return () => clearTimeout(timer);
  }, [copy]);

  return (
    <div className="buttons-group">
      <Button
        className="btn-b64-copy"
        onClick={() => handleOnclick(COPY_TYPE.B64)}
      >
        <img
          src={copy !== COPY_TYPE.B64 ? "copy.png" : "check.png"}
          alt="copy image"
        />
        {copy !== COPY_TYPE.B64 ? "Copy B64" : "Copied"}
      </Button>
      <Button
        className="btn-url-copy"
        onClick={() => handleOnclick(COPY_TYPE.URL)}
      >
        <img
          src={copy !== COPY_TYPE.URL ? "copy.png" : "check.png"}
          alt="copy image"
        />
        {copy !== COPY_TYPE.URL ? "Copy URL Encoded" : "Copied"}
      </Button>
    </div>
  );
};

export default Buttons;
