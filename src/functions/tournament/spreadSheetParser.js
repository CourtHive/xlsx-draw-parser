import XLSX from "xlsx";

import { processRoundRobin } from "functions/drawStructures/roundRobin/processRoundRobin";
import { processKnockOut } from "functions/drawStructures/knockOut/processKnockOut";
import { extractInfo } from "functions/dataExtraction/extractInfo";
import { identifySheet } from "functions/tournament/profileFx";
import { createTournamentRecord } from "./tournamentRecord";
import { workbookTypes } from "types/workbookTypes";
import { xlsxStore } from "stores/xlsxStore";

import {
  KNOCKOUT,
  ROUND_ROBIN,
  PARTICIPANTS,
  INFORMATION,
} from "../../types/sheetTypes";

export function spreadSheetParser(file_content) {
  xlsxStore.dispatch({ type: "loading state", payload: true });
  console.clear();

  const filterValueStorage = "xlsxSheetFilter";
  const sheetFilter = localStorage.getItem(filterValueStorage)?.toLowerCase();
  const workbook = XLSX.read(file_content, { type: "binary" });

  let draws = [];
  let tournamentData = {};

  let allPlayers = {};
  let allParticipants = {};

  const sheetNames = workbook.SheetNames;
  const workbookType = identifyWorkbook({ sheetNames });
  console.log({ workbookType });
  if (!workbookType) return notifyNotIdentified();

  let profile = workbookType.profile;
  if (!profile) return missingProfile({ workbookType });

  const sheetFilterFx = (sheet) =>
    !sheetFilter || sheet.toLowerCase().includes(sheetFilter);
  const sheetsToProcess = sheetNames.filter(sheetFilterFx);

  console.log("%c Processing sheets...", "color: lightgreen", sheetsToProcess);

  const pushData = ({ drawInfo, playersMap, participantsMap }) => {
    Object.assign(allParticipants, participantsMap || {});
    Object.assign(allPlayers, playersMap || {});
    draws.push(drawInfo);
  };

  const addKnockoutData = ({ sheet, sheetName, sheetDefinition }) => {
    const data = processKnockOut({
      sheetDefinition,
      sheetName,
      profile,
      sheet,
    });
    pushData(data);
  };

  const addRoundRobinData = ({ sheet, sheetName, sheetDefinition }) => {
    const data = processRoundRobin({
      sheetDefinition,
      sheetName,
      profile,
      sheet,
    });
    pushData(data);
  };

  const processSheet = (sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetDefinition = identifySheet({ sheetName, sheet, profile });
    const toProcess = sheetsToProcess.includes(sheetName);
    if (!sheetDefinition) {
      missingSheetDefinition({ toProcess, sheetName });
    } else if (toProcess && sheetDefinition.type === KNOCKOUT) {
      addKnockoutData({ sheet, sheetName, sheetDefinition });
    } else if (toProcess && sheetDefinition.type === ROUND_ROBIN) {
      addRoundRobinData({ sheet, sheetName, sheetDefinition });
    } else if (toProcess && sheetDefinition.type === PARTICIPANTS) {
      logSheetDefinition({ sheetName, sheetDefinition });
    } else if (sheetDefinition.type === INFORMATION) {
      if (toProcess) {
        logSheetDefinition({ sheetName, sheetDefinition });
      }

      const tournamentInfo = extractInfo({
        infoClass: "tournamentInfo",
        profile,
        sheet,
      });
      Object.assign(tournamentData, tournamentInfo);
    } else if (toProcess) {
      missingSheetDefinition({ toProcess, sheetName });
    }
  };

  sheetNames.forEach(processSheet);

  const providerId = profile && profile.providerId;
  Object.assign(tournamentData, { providerId });
  createTournamentRecord({
    allParticipants,
    tournamentData,
    allPlayers,
    draws,
  });
}

function logSheetDefinition({ sheetName, sheetDefinition }) {
  const message = `%c sheetDefinition for ${sheetName} is ${sheetDefinition.type}`;
  const color = "cyan";
  console.log(message, `color: ${color}`);
}

function missingSheetDefinition({ toProcess, sheetName }) {
  const message = `%c sheetDefinition not found: ${sheetName}`;
  if (toProcess) {
    const color = "yellow";
    console.log(message, `color: ${color}`);
  }
}

function missingProfile({ workbookType }) {
  xlsxStore.dispatch({
    type: "toaster state",
    payload: {
      severity: "error",
      message: `Missing profile for ${workbookType.organization}`,
    },
  });
}

function notifyNotIdentified() {
  xlsxStore.dispatch({
    type: "toaster state",
    payload: {
      severity: "error",
      message: `Cannot Identify Workbook`,
      cancelLoading: true,
    },
  });
}

function identifyWorkbook({ sheetNames }) {
  return workbookTypes.reduce((type, currentType) => {
    const sheetNameMatcher = currentType.sheetNameMatcher;
    const containsRequiredSheets = currentType.mustContainSheetNames.some(
      (sheetName) => sheetNames.includes(sheetName)
    );
    const matchesFound = sheetNameMatcher && sheetNameMatcher(sheetNames);
    return containsRequiredSheets || matchesFound ? currentType : type;
  }, undefined);
}
