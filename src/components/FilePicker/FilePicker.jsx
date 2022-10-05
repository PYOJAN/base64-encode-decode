import React, { useState, useMemo } from "react";
import { getBase64 } from "../../utils/fileReader";
import Buttons from "../Buttons/Buttons";

import "./filePicker.scss";

const FilePicker = ({
  title = "",
  acceptType = [],
  onLoadSuccess = (B64) => {},
  children,
}) => {
  const [file, setFile] = useState("");
  const [fileSelected, setFileSelected] = useState(false);

  const type = {
    pdf: "application/pdf",
    text: "text/plain",
    xml: "text/xml",
  };

  const accept = useMemo(() => {
    let ACCEPT_FILE = [];
    for (let accept of acceptType) {
      ACCEPT_FILE.push(type[accept]);
    }

    return ACCEPT_FILE;
  }, []);

  const handleOnchange = (e) => {
    e.preventDefault();
    setFileSelected(true);

    const fileData = e.target.files[0];
    let fileType = null;
    for (let hasFile of acceptType) {
      if (fileData.type === type[hasFile]) {
        fileType = type[hasFile];
        break;
      }
    }

    if (fileType && fileData) {
      getBase64(fileData)
        .then((base64) => {
          const B64 = base64.split(`data:${fileType};base64,`)[1];

          onLoadSuccess(B64);
          setFile(B64);
          setFileSelected(false);
        })
        .catch((err) => {
          alert(err.message);
          setFileSelected(false);
        });
    } else {
      alert(
        `Only ${acceptType.toString().split(",").join(", ")} file is allowed.`
      );
      setFileSelected(false);
    }
  };
  return (
    <div className={`file-picker`}>
      <h3>{title}</h3>
      <h4></h4>

      <label
        htmlFor="filepicker"
        className={`file-pick ${fileSelected ? "converting" : ""}`}
      >
        {fileSelected ? "Converting......" : "Browse file"}
      </label>
      <input
        type="file"
        name="filepicker"
        id="filepicker"
        onChange={(e) => !fileSelected && handleOnchange(e)}
        accept={accept.toString()}
      />

      {file && (
        <div className="copy-btn">
          <Buttons data={file} />
        </div>
      )}
      {children}
    </div>
  );
};

export default FilePicker;
