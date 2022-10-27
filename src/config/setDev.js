import { idiomsAvailable } from "services/communications/idiomService";
import { changeIdiom, checkIdiomUpdate } from "services/changeIdiom";
import { selectIdiom } from "components/dialogs/idiomSelector";
import { normalizeScore } from "functions/cleanScore";
import * as factory from "tods-competition-factory";
import { tidyScore } from "functions/scoreParser";
import { xlsxStore } from "stores/xlsxStore";
import Cookies from "js-cookie";
import i18n from "i18next";

export function setDev() {
  window.dev = {};
  addDev({ i18n });
  addDev({ Cookies });
  addDev({ xlsxStore });
  addDev({ selectIdiom });
  addDev({ changeIdiom });
  addDev({ idiomsAvailable });
  addDev({ checkIdiomUpdate });
  addDev({ factory, tournamentEngine: factory.tournamentEngine });

  addDev({ tidyScore });
  addDev({ normalizeScore });
}

let ad_errors = 0;
export function addDev(variable) {
  try {
    Object.keys(variable).forEach((key) => (window.dev[key] = variable[key]));
  } catch (err) {
    if (!ad_errors) {
      console.log("production environment");
      ad_errors += 1;
    }
  }
}
