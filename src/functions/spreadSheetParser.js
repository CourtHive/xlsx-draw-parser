import XLSX from 'xlsx';

import { xlsxStore } from 'stores/xlsxStore';
import { extractInfo } from 'functions/extractInfo';
import { workbookTypes } from 'types/workbookTypes';
import { identifySheet } from 'functions/profileFx';
import { processKnockOut } from 'functions/processKnockOut';
import { processRoundRobin } from 'functions/processRoundRobin';

import { KNOCKOUT, ROUND_ROBIN, PARTICIPANTS, INFORMATION } from '../types/sheetTypes';

export function spreadSheetParser(file_content) {
  xlsxStore.dispatch({type: 'loading state', payload: true});
  const filterValueStorage = 'xlsxSheetFilter';
  const sheetFilter = localStorage.getItem(filterValueStorage)
  let tournamentRecord = {
    draws: []
  };
  const workbook = XLSX.read(file_content, { type: 'binary' });
  
  const sheetNames = workbook.SheetNames;
  const workbookType = identifyWorkbook({sheetNames});
  if (workbookType) {
    const profile = workbookType.profile;
    if (!profile) {
      xlsxStore.dispatch({
        type: 'toaster state',
        payload: {
          severity: 'error',
          message: `Missing profile for ${workbookType.organization}`
        }
      });
      return;
    }
    const sheetsToProcess = sheetNames
      .filter(sheet => workbookType.validSheet(sheet))
      .filter(sheet => !sheetFilter || sheet.toLowerCase().includes(sheetFilter.toLowerCase()));
    
    console.clear();
    console.log('%c Processing sheets...', 'color: lightgreen', sheetsToProcess);
    
    sheetNames.forEach(sheetName => {
      let message = '';
      let color = 'cyan';
     
      const sheet = workbook.Sheets[sheetName];
      const sheetDefinition = identifySheet({sheetName, sheet, profile});
      const processSheet = sheetsToProcess.includes(sheetName);
      if (!sheetDefinition) {
        message = `%c sheetDefinition not found: ${sheetName}`;
        if (processSheet) {
          color = 'yellow';
          console.log(message, `color: ${color}`);
        }
      } else if (processSheet && sheetDefinition.type === KNOCKOUT) {
        const { drawInfo } = processKnockOut({profile, sheet, sheetName, sheetDefinition});
        tournamentRecord.draws.push(drawInfo);
      } else if (processSheet && sheetDefinition.type === ROUND_ROBIN) {
        const { drawInfo } = processRoundRobin({profile, sheet, sheetName, sheetDefinition});
        console.log({drawInfo});
      } else if (processSheet && sheetDefinition.type === PARTICIPANTS) {
        message = `%c sheetDefinition for ${sheetName} is ${sheetDefinition.type}`;
        console.log(message, `color: ${color}`)
      } else if (sheetDefinition.type === INFORMATION) {
        if (processSheet) {
          message = `%c sheetDefinition for ${sheetName} is ${sheetDefinition.type}`;
          console.log(message, `color: ${color}`)
        }

        const tournamentInfo = extractInfo({profile, sheet, infoClass: 'tournamentInfo'})
        const { tournamentId } = generateTournamentId({tournamentInfo});
        Object.assign(tournamentRecord, tournamentInfo, { tournamentId });
      } else {
        color = 'yellow'
        message = `%c sheetDefinition not found: ${sheetName}`;
        console.log(message, `color: ${color}`);
      }
    });
  }

  xlsxStore.dispatch({ type: 'set tournament record', payload: tournamentRecord });
}

function generateTournamentId({tournamentInfo}={}) {
  let tournamentId;
  const { tournamentName, startDate='', categories=[], city='' } = tournamentInfo;
  const categoryString = categories.join('');
  if (tournamentName) {
    const name = tournamentName.split(' ').join('_');
    tournamentId = [name, city, categoryString, startDate].join('_');
  }
  return { tournamentId };
}

function identifyWorkbook({sheetNames}) {
  return workbookTypes.reduce((type, currentType) => {
    const containsValidSheet = sheetNames.reduce((result, sheet) => currentType.validSheet(sheet) || result, false);
    const requiredSheetTest = currentType.mustContainSheetNames.map(sheetName => sheetNames.includes(sheetName));
    const containsRequiredSheets = !requiredSheetTest.includes(false);
    return containsValidSheet && containsRequiredSheets ? currentType : type;
  }, undefined);
}
