import React from "react";

import "./button.scss";

const Button = ({ children = "Button", onClick = (e) => {}, className }) => {
  return (
    <button onClick={(e) => onClick(e)} className={className}>
      {children}
    </button>
  );
};

export default Button;
