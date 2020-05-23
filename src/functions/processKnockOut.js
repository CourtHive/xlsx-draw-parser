import { HEADER, FOOTER } from 'types/sheetElements';

import { findRow } from 'functions/sheetAccess.js';
import { extractInfo } from 'functions/extractInfo';
import { tournamentDraw } from 'functions/constructDraw';
import { generateRange, hashId } from 'functions/utilities';
import { getParticipantRows } from 'functions/getParticipantRows';
import { extractDrawParticipants } from 'functions/extractDrawParticipants';
import { findRowDefinition, getHeaderColumns } from 'functions/profileFx';

export function processKnockOut({profile, sheet, sheetName, sheetDefinition}) {
  let message = `%c sheetDefinition for ${sheetName} is ${sheetDefinition.type}`;
  console.log(message, `color: cyan`)

  const rowDefinitions = profile.rowDefinitions;
  const headerRowDefinition = findRowDefinition({ rowDefinitions, rowIds: sheetDefinition.rowIds, type: HEADER });
  const footerRowDefinition = findRowDefinition({ rowDefinitions, rowIds: sheetDefinition.rowIds, type: FOOTER });

  const headerRows = findRow({sheet, rowDefinition: headerRowDefinition, allTargetRows: true});
  const footerRows = findRow({sheet, rowDefinition: footerRowDefinition, allTargetRows: true});
  const headerRow = headerRows[0];
  const footerRow = footerRows[footerRows.length - 1];
  const headerAvoidRows = headerRows.map(headerRow => {
    const startRange = +headerRow;
    const endRange = +headerRow + (headerRowDefinition.rows || 0);
    return generateRange(startRange, endRange);
  });
  const footerAvoidRows = footerRows.map(footerRow => {
    const startRange = +footerRow;
    const endRange = +footerRow + (footerRowDefinition.rows || 0);
    return generateRange(startRange, endRange);
  });
  const avoidRows = [].concat(...headerAvoidRows, ...footerAvoidRows);
  const columns = getHeaderColumns({sheet, profile, headerRow});

  const {rows, range, finals, preround_rows} = getParticipantRows({sheet, profile, headerRow, footerRow, avoidRows, columns});
  const { players, isDoubles } = extractDrawParticipants({ profile, sheet, headerRow, columns, rows, range, finals, preround_rows });
  const drawFormat = isDoubles ? 'DOUBLES' : 'SINGLES';
  
  const drawInfo = extractInfo({profile, sheet, infoClass: 'drawInfo'});
  const gender = drawInfo.gender;

  const playerData = { players, rows, range, finals, preround_rows };
  const { matchUps, stage } = tournamentDraw({profile, sheet, columns, headerRow, gender, playerData}) 
  const { entries, positionAssignments, seedAssignments } = getEntries({matchUps, drawFormat});
 
  Object.assign(drawInfo, { drawFormat, stage });
  const sizes = [matchUps, entries, positionAssignments, seedAssignments].map(v => v.length);
  const fodder = sizes.concat(...Object.values(drawInfo).filter(v => typeof v === 'string')).sort().join('');
  const drawId = hashId(fodder);

  const TodsMatchUps = matchUps.map(matchUp => {
    const drawPositions = matchUp.drawPositions.sort((a, b) => a - b);
    const matchUpId = `${drawId}-${drawPositions.join('')}`
    const winningSide = drawPositions.indexOf(matchUp.winners[0].drawPosition);
    return { matchUpId, drawPositions, score: matchUp.result, winningSide };
  })

  const structures = [
    { 
      stage,
      stageSequence: 1,
      seedAssignments,
      positionAssignments,
      matchUps: TodsMatchUps,
      finishingPosition: 'roundOutcome'
    }
  ];

  Object.assign(drawInfo, { drawId, stage, matchUps, structures, entries });
  matchUps.forEach(matchUp => matchUp.event = drawInfo.event);

  return { drawInfo };
}

function getEntries({matchUps}) {
  const matchUpSides = matchUps
    .map(matchUp => [matchUp.winners, matchUp.losers])

  const matchUpPlayers = matchUpSides
    .flat(Infinity)
    .map(participant => ({ [participant.id]: participant }));
  
  const playersMap = Object.assign({}, ...matchUpPlayers);
  const players = Object.keys(playersMap).map(key => playersMap[key]);

  const participantsMap = Object.assign({}, ...matchUpSides.map(matchUp => matchUp.map(getSideParticipant)).flat());
  const seedAssignments = Object.keys(participantsMap)
    .map(participantId => ({ participantId, seedNumber: participantsMap[participantId].seedNumber }))
    .sort((a, b) => a.seedNumber - b.seedNumber);
  const positionAssignments = Object.keys(participantsMap)
    .map(participantId => ({ participantId, drawPosition: participantsMap[participantId].drawPosition }))
    .sort((a, b) => a.drawPosition - b.drawPosition);
  const entries = Object.keys(participantsMap)
    .map(participantId => ({ participantId }));
  
  return { players, entries, seedAssignments, positionAssignments };
}

function getSideParticipant(side, i) {
  const participantId = side.map(player => player.id).sort().join('-');
  const drawPosition = side[0].drawPosition;
  const seedNumber = side[0].seed;
  const participant = { [participantId]: { drawPosition, seedNumber }};
  return participant;
}