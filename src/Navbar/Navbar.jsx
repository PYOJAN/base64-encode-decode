import React, { useState } from "react";
import { navItems } from "./navItems";
import "./navbar.scss";

const Navbar = ({ onPageChange }) => {
  const [active, setActive] = useState("P1");

  const handleOnClick = (activeNav, page) => {
    onPageChange(page);

    setActive(activeNav);
  };

  return (
    <ul className="nav__items">
      {navItems.map((item, index) => (
        <li
          key={item.id}
          className={`nav__item ${item.id === active ? "active" : ""}`}
          onClick={() => handleOnClick(item.id, index + 1)}
        >
          <img src={item.icon} alt="icon" />
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  );
};

export default Navbar;
