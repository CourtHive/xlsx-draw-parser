import { unique } from 'functions/utilities';
import { getDrawPosition } from 'functions/drawFx';
import { normalizeScore } from 'functions/cleanScore';
import { getRow, getCellValue } from 'functions/sheetAccess';

export function getColumnMatches({
   sheet,
   round,
   players,
   isDoubles,
   matchOutcomes,
   expectOutcomes,
   expectedRowRanges,
   expectedGroupings
}) {
   // eslint-disable-next-line 
   const scoreMatching = /[\d\(]+[\d\.\(\)\[\]\\ \:\-\,\/O]+(Ret)?(ret)?(RET)?[\.]*$/;
   const roundColumnValues = round.column_references.map(reference => {
      const cellRow = getRow(reference);
      const cellValue = getCellValue(sheet[reference]);
      const drawPosition = getDrawPosition({ value: cellValue, players});
      const isScoreValue = cellValue.match(scoreMatching);
      const isMatchOutcome = matchOutcomes
         .map(ending => cellValue.toLowerCase().indexOf(ending.toLowerCase()) >= 0).reduce((a, b) => a || b, undefined);
      return { cellValue, cellRow, drawPosition, isScoreValue, isMatchOutcome }
   });

   let lastCellRow = 0;
   const discontinuities = unique(roundColumnValues.map((value, i) => {
      const isWhiteSpace = value.cellRow - lastCellRow > 1;
      const isOutcome = value.isScoreValue || value.isMatchOutcome;
      lastCellRow = value.cellRow;
      return isWhiteSpace ? i : isOutcome ? i + 1 : undefined;
   }).filter(f=>f));

   let lastDisconiuity = 0;
   let columnOutcomes = discontinuities.map(discontinuity => {
      const grouping = roundColumnValues.slice(lastDisconiuity, discontinuity);
      lastDisconiuity = discontinuity;
      return grouping;
   });
   const finalDiscontinuity = roundColumnValues.slice(lastDisconiuity);
   if (finalDiscontinuity.length) columnOutcomes.push(finalDiscontinuity);

   const groupingLengthWithResult = isDoubles ? 3 : 2;
   const allOutcomes = columnOutcomes.reduce((allOutcomes, grouping) => {
      return grouping.length === groupingLengthWithResult && allOutcomes;
   }, true);
   if (expectOutcomes) { columnOutcomes = columnOutcomes.filter(groupings => groupings.length === groupingLengthWithResult); }

   const columnMatchUps = columnOutcomes.map(grouping => {
      const cellRow = grouping[0].cellRow;
      const drawPosition = grouping[0].drawPosition;
      const result = grouping.length === groupingLengthWithResult && normalizeScore(grouping[grouping.length - 1].cellValue);
      return {
         cellRow,
         result: result || '',
         winners: [drawPosition],
         drawPositions: [drawPosition],
         winningSide: players.filter(player => +player.drawPosition === +drawPosition)
      }
   });

   console.log({roundColumnValues, discontinuities, columnOutcomes, columnMatchUps})
   
   const containsEmbeddedMatchUps = columnOutcomes.length > expectedGroupings.length;
   if (containsEmbeddedMatchUps) console.log('%c EMBEDDED', 'color: pink', {columnOutcomes, expectedGroupings})
   const roundMatchUps = columnMatchUps.filter((matchUp, i) => !containsEmbeddedMatchUps || (1 - i%2));
   const embeddedMatchUps = columnMatchUps.filter((matchUp, i) => containsEmbeddedMatchUps && i%2);
   
   const expectedRoundMatchUps = expectedRowRanges.map(rowRange => {
      if (!rowRange.length || rowRange.length !== 2) return undefined;
      return columnMatchUps.reduce((matchUp, candidate) => {
         return candidate.cellRow >= rowRange[0] && candidate.cellRow < rowRange[1] ? candidate : matchUp;
      }, undefined);
   }).filter(isPresent);

   const unExpectedRoundMatchUps = columnMatchUps.filter(matchUp => {
      let notFound = expectedRowRanges.reduce((notFound, rowRange) => {
         if (!rowRange.length || rowRange.length !== 2) return notFound;
         let found = (matchUp.cellRow >= rowRange[0] && matchUp.cellRow < rowRange[1]);
         return !found && notFound;
      }, true);
      return notFound;
   });

   console.log({expectedRowRanges, expectedRoundMatchUps, roundMatchUps, unExpectedRoundMatchUps})
   
   const winnerDrawPositions = [].concat(...roundMatchUps.map(matchUp => matchUp.drawPositions));
   
   const winnerRowNumbers = columnOutcomes.map(groupings => {
      return groupings.reduce((rowNumber, grouping) => grouping.cellRow || rowNumber, undefined);
   }).filter(isPresent);
   
   // console.log({roundColumnValues, discontinuities, containsEmbeddedMatchUps, columnOutcomes, columnMatchUps, roundMatchUps, embeddedMatchUps});
   // console.log({expectedGroupings, winnerRowNumbers, columnMatchUps, expectedRoundMatchUps, unExpectedRoundMatchUps});
 
  return { matchUps: roundMatchUps, embeddedMatchUps, winnerDrawPositions, winnerRowNumbers, allOutcomes };

  function isPresent(entity) { return entity; }
};
