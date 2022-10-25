import React from "react";
import { useTranslation } from "react-i18next";

import { loadSpreadsheet } from "services/loadSpreadsheet";
import { dropModal } from "components/dialogs/dragDropModal";
import { IconButton, Tooltip } from "@material-ui/core/";
import { CloudUpload } from "@material-ui/icons";

export function LoadButton() {
  const { t } = useTranslation();
  return (
    <Tooltip title={t("Load")} aria-label={t("Load")}>
      <IconButton
        edge="start"
        color="inherit"
        aria-label={t("Load")}
        onClick={() => dropModal({ callback: loadSpreadsheet })}
      >
        <CloudUpload />
      </IconButton>
    </Tooltip>
  );
}
