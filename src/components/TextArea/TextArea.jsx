import React from "react";

import "./textarea.scss";

const TextArea = ({
  isDisabled = true,
  value = "",
  placeholder = "",
  className = "",
  onChange = (e) => {},
  children,
}) => {
  return (
    <div className="resultViewer">
      <textarea
        className={className}
        name="result"
        id="result"
        value={value}
        placeholder={placeholder}
        disabled={isDisabled}
        onChange={(e) => onChange(e)}
      ></textarea>
      {children}
    </div>
  );
};

export default TextArea;
