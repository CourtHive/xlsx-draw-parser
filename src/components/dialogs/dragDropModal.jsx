import React from "react";

import "react-dropzone-uploader/dist/styles.css";
import Dropzone from "react-dropzone-uploader";

import { useTranslation } from "react-i18next";
import { dialogModal } from "../modals/dialogModal";

export function dropModal({
  callback,
  dropzoneText,
  dropzoneReject,
  accept,
} = {}) {
  let content = (
    <DropAccept
      callback={handleCallback}
      dropzoneText={dropzoneText}
      dropzoneReject={dropzoneReject}
      accept={accept}
    />
  );
  dialogModal.open({
    icon: "upload",
    title: "Import Spreadsheet",
    escapeClose: true,
    outsideClickClose: true,
    content,
  });

  function handleCallback(result) {
    dialogModal.close();
    if (callback && typeof callback === "function") callback(result);
  }
}

const DropAccept = ({
  callback,
  dropzoneText,
  dropzoneReject,
  accept,
} = {}) => {
  const { t } = useTranslation();
  const handleChangeStatus = ({ meta, file }, status) => {
    if (status === "done") {
      if (callback && typeof callback === "function") callback(file);
    } else if (status === "aborted") {
      console.log(`${meta.name}, upload failed...`);
    }
  };

  const getInputLabel = (files, extra) =>
    extra.reject ? { color: "red" } : {};
  const getInputContent = (files, extra) => {
    let willreject = dropzoneReject || t("XLS files only");
    let acceptable = dropzoneText || t("Drag and Drop");
    return extra.reject ? willreject : acceptable;
  };

  return (
    <Dropzone
      autoUpload={false}
      maxFiles={1}
      multiple={false}
      canCancel={false}
      onChangeStatus={handleChangeStatus}
      accept={
        accept ||
        "application/vnd.ms-excel, application/vnd.ms-excel.sheet.macroenabled.12, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
      inputContent={getInputContent}
      styles={{
        dropzone: { width: 400, height: 200 },
        dropzoneActive: { borderColor: "green" },
        dropzoneReject: { borderColor: "red", backgroundColor: "#DAA" },
        inputLabel: getInputLabel,
      }}
    />
  );
};
