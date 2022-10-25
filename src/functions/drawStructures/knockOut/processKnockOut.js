import { HEADER, FOOTER } from "types/sheetElements";

import { extractKnockOutParticipants } from "functions/dataExtraction/extractKnockOutParticipants";
import { constructKnockOut } from "functions/drawStructures/knockOut/constructKnockOut";
import { getParticipantRows } from "functions/drawStructures/getParticipantRows";
import { extractInfo } from "functions/dataExtraction/extractInfo";
import { findRow } from "functions/dataExtraction/sheetAccess";
import { generateRange, hashId } from "functions/utilities";
import { getEntries } from "../getEntries";
import {
  findRowDefinition,
  getHeaderColumns,
} from "functions/tournament/profileFx";

export function processKnockOut({
  profile,
  sheet,
  sheetName,
  sheetDefinition,
}) {
  let message = `%c sheetDefinition for ${sheetName} is ${sheetDefinition.type}`;
  console.log(message, `color: cyan`);

  const rowDefinitions = profile.rowDefinitions;
  const headerRowDefinition = findRowDefinition({
    rowIds: sheetDefinition.rowIds,
    rowDefinitions,
    type: HEADER,
  });
  const footerRowDefinition = findRowDefinition({
    rowIds: sheetDefinition.rowIds,
    rowDefinitions,
    type: FOOTER,
  });

  const headerRows = findRow({
    sheet,
    rowDefinition: headerRowDefinition,
    allTargetRows: true,
  });
  const footerRows = findRow({
    sheet,
    rowDefinition: footerRowDefinition,
    allTargetRows: true,
  });
  const headerRow = headerRows[0];
  const footerRow = footerRows[footerRows.length - 1];
  const headerAvoidRows = headerRows.map((headerRow) => {
    const startRange = +headerRow;
    const endRange = +headerRow + (headerRowDefinition.rows || 0);
    return generateRange(startRange, endRange);
  });
  const footerAvoidRows = footerRows.map((footerRow) => {
    const startRange = +footerRow;
    const endRange = +footerRow + (footerRowDefinition.rows || 0);
    return generateRange(startRange, endRange);
  });
  const avoidRows = [].concat(...headerAvoidRows, ...footerAvoidRows);
  const columns = getHeaderColumns({ sheet, profile, headerRow });

  const drawInfo = extractInfo({ profile, sheet, infoClass: "drawInfo" });
  const gender = drawInfo.gender;

  const { rows, range, finals, preRoundRows } = getParticipantRows({
    headerRow,
    footerRow,
    avoidRows,
    profile,
    columns,
    sheet,
  });
  const { players, isDoubles } = extractKnockOutParticipants({
    preRoundRows,
    headerRow,
    columns,
    profile,
    gender,
    sheet,
    range,
    finals,
    rows,
  });
  console.log({
    headerRow,
    columns,
    rows,
    range,
    finals,
    preRoundRows,
    profile,
  });
  const drawFormat = isDoubles ? "DOUBLES" : "SINGLES";

  const playerData = { players, rows, range, finals, preRoundRows };
  const { matchUps, stage } = constructKnockOut({
    profile,
    sheet,
    columns,
    headerRow,
    gender,
    playerData,
  });
  const {
    entries,
    playersMap,
    participantsMap,
    positionAssignments,
    seedAssignments,
  } = getEntries({ matchUps, drawFormat });

  Object.assign(drawInfo, { drawFormat, stage });
  const sizes = [matchUps, entries, positionAssignments, seedAssignments].map(
    (v) => v.length
  );
  const fodder = sizes
    .concat(...Object.values(drawInfo).filter((v) => typeof v === "string"))
    .sort()
    .join("");
  const drawId = hashId(fodder);

  const TodsMatchUps = matchUps.map((matchUp) => {
    const drawPositions = matchUp.drawPositions.sort((a, b) => a - b);
    const matchUpId = `${drawId}-${drawPositions.join("")}-M`;
    const winningSide = drawPositions.indexOf(matchUp.winningDrawPosition) + 1;
    return {
      matchUpId,
      drawPositions,
      score: matchUp.result,
      roundName: matchUp.roundName,
      roundNumber: matchUp.roundNumber,
      roundPosition: matchUp.roundPosition,
      finishingRound: matchUp.finishingRound,
      winningSide,
    };
  });

  const structureIdFodder = `${fodder}${stage}`;
  const structureId = `${hashId(structureIdFodder)}-S`;
  const structure = {
    stage,
    structureId,
    stageSequence: 1,
    seedAssignments,
    positionAssignments,
    matchUps: TodsMatchUps,
    finishingPosition: "roundOutcome",
  };

  Object.assign(drawInfo, { drawId, stage, matchUps, structure, entries });
  matchUps.forEach((matchUp) => (matchUp.event = drawInfo.event));

  return { drawInfo, playersMap, participantsMap };
}

/*
function getEntries({matchUps}) {
  const matchUpSides = matchUps
    .map(matchUp => [matchUp.winningSide, matchUp.losingSide])

  const matchUpPlayers = matchUpSides
    .flat(Infinity)
    .filter(participant => participant && !participant.isBye)
    .map(participant => ({ [participant.participantId]: participant }));

  const playersMap = Object.assign({}, ...matchUpPlayers);

  const participantsMap = Object.assign({}, ...matchUpSides
    .map(matchUp => matchUp.map(getSideParticipant).filter(f=>f))
    .flat());
    
  const seedAssignments = Object.keys(participantsMap)
    .map(participantId => ({ participantId, seedNumber: participantsMap[participantId].seedNumber }))
    .sort((a, b) => a.seedNumber - b.seedNumber);
   
  const positionAssignments = Object.keys(participantsMap)
    .map(participantId => ({
      participantId,
      drawPosition: participantsMap[participantId].drawPosition
    }))
    .sort((a, b) => a.drawPosition - b.drawPosition);

  const entries = Object.keys(participantsMap).map(eventEntry);
  
  return { playersMap, participantsMap, entries, seedAssignments, positionAssignments };

  function eventEntry(participantId) {
    const playerParticipant = playersMap[participantId];
    const categoryRanking = playerParticipant && playerParticipant.rank;
    const entry = {
      participantId,
      categoryRanking
    }
    return entry;
  }
}

function getSideParticipant(side, i) {
  const isBye = !side || side.reduce((p, c) => c.isBye, undefined);
  if (!isBye && side[0]) {
    const participantIds = side.map(player => player.participantId);
    const participantId = participantIds.sort().join('|');
    const drawPosition = side[0].drawPosition;
    const seedNumber = side[0].seed;
    const participant = { [participantId]: { drawPosition, seedNumber, participantIds }};
    return participant;
  }
}

*/
