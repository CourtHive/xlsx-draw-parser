import { tidyScore } from "functions/scoreParser";
import { normalizeScore } from "functions/cleanScore";
import { hashId, generateRange } from "functions/utilities";
import { nameHash, lastFirstI } from "functions/drawStructures/drawFx";
import {
  getRow,
  getCellValue,
  numberValue,
} from "functions/dataExtraction/sheetAccess";
import { SINGLES } from "types/todsConstants";

export function extractRoundRobinParticipants({
  profile,
  sheet,
  columns,
  rows,
  range,
  gender,
  finals,
  preRoundRows,
}) {
  const getValue = (key) => getCellValue(sheet[key]);
  const isNumeric = (value) => /^\d+(a)?$/.test(value);
  const isSingleAlpha = (key) => key && key.length > 1 && isNumeric(key[1]);

  let isDoubles = false;
  let lastDrawPositionCharCode;

  let players = [];
  let playerRows = [];
  let resultRows = [];
  let drawPositions = [];
  let playerLastNames = [];
  let groupMemberCount = {};
  let playoffRowValues = [];
  let bracketHeaderRows = [];
  const extract_seed = /\[(\d+)(\/\d+)?\]/;
  const rowOffset = profile.doubles.drawPosition.rowOffset;
  const drawPositionIsNumber = false;

  rows.forEach((row) => {
    const drawPosition = drawPositionIsNumber
      ? numberValue(sheet, `${columns.position}${row}`)
      : getCellValue(sheet[`${columns.position}${row}`]);
    const dpcc = drawPosition.charCodeAt();
    const player = extractPlayer({ row, drawPosition, isDoubles });
    const validDrawPosition =
      player &&
      drawPosition &&
      (!lastDrawPositionCharCode || lastDrawPositionCharCode + 1 === dpcc);
    if (validDrawPosition) {
      drawPositions.push(drawPosition);
      players.push(player);
      playerRows.push(row);
      playerLastNames.push(player.last_name.toUpperCase());
    } else if (drawPosition) {
      if (drawPositions.includes(drawPosition)) {
        resultRows.push(row);
        const playerGroup = bracketHeaderRows.length;
        if (playerGroup) {
          groupMemberCount[playerGroup] =
            (groupMemberCount[playerGroup] || 0) + 1;
        }
      } else {
        const inRow = (key) => getRow(key) === row;
        const rowKeys = Object.keys(sheet).filter(inRow).filter(isSingleAlpha);
        const rowValues = rowKeys.map(getValue).filter(Boolean);

        const rowValuesIncludePlayers = rowValues.reduce(
          (includePlayers, value) => {
            return playerLastNames.includes(value) ? true : includePlayers;
          },
          false
        );
        const rowIsPlayoff = rowValues.reduce((rowIsPlayoff, value) => {
          return value === "vs." ? true : rowIsPlayoff;
        }, false);

        if (rowValuesIncludePlayers) bracketHeaderRows.push(row);
        if (rowIsPlayoff && rowValues.length > 4) {
          playoffRowValues.push(rowValues);
        }
      }
    }
  });

  let matchUps = resultRows
    .map((row) => {
      return extractMatchUps({
        bracketHeaderRows,
        groupMemberCount,
        row,
        players,
      }).matchUps;
    })
    .flat(Infinity);

  let playoffMatchUps = getPlayoffMatchUps({ playoffRowValues });

  matchUps = matchUps.concat(playoffMatchUps);

  return { players, matchUps, isDoubles };

  function getPlayoffMatchUps({ playoffRowValues }) {
    let playoffMatchUps = playoffRowValues
      .map((rowValues) => {
        const vs = rowValues.indexOf("vs.");
        const side1 = playerByLastName({ lastName: rowValues[vs - 1] });
        const side2 = playerByLastName({ lastName: rowValues[vs + 1] });
        if (!side1 || !side2) {
          console.log({ rowValues });
          return undefined;
        }
        const result = rowValues[vs + 2];
        const { winnerIndex, score } = getWinnerIndex(result) || {};
        const winningSide = winnerIndex ? [side2] : [side1];
        const losingSide = winnerIndex ? [side1] : [side2];
        const matchUp = {
          result: score,
          gender,
          losingSide,
          winningSide,
          roundName: "Playoff",
          matchType: SINGLES,
          drawPositions: [side1.drawPosition, side2.drawPosition],
        };
        return matchUp;
      })
      .filter(Boolean);
    return playoffMatchUps;
  }

  function playerByLastName({ lastName }) {
    const last = lastName.split(" ")[0];
    return players.reduce((player, candidate) => {
      return candidate.last_name === last ? candidate : player;
    }, undefined);
  }

  function extractMatchUps({
    bracketHeaderRows,
    groupMemberCount,
    row,
    players,
  }) {
    const groupNumber = bracketHeaderRows.reduce(
      (groupNumber, headerRow, i) => {
        return row > headerRow ? i + 1 : groupNumber;
      },
      undefined
    );
    const previousGroupMemberCount = generateRange(1, groupNumber).reduce(
      (count, groupNumber) => {
        return count + groupMemberCount[groupNumber];
      },
      0
    );

    const inRow = (key) => getRow(key) === row;
    const rowKeys = Object.keys(sheet).filter(inRow).filter(isSingleAlpha);
    const rowValues = rowKeys.map(getValue);
    const drawPosition = rowValues[0];
    const results = rowValues.slice(2);
    const participant = players.reduce(
      (player, candidate) =>
        candidate.drawPosition === drawPosition ? candidate : player,
      undefined
    );

    const opponents = players
      .filter((player) => player.drawPosition !== drawPosition)
      .slice(previousGroupMemberCount);

    const matchUps = opponents
      .map((opponent, i) => {
        const result = results[i];
        const { winnerIndex, score } = (result && getWinnerIndex(result)) || {};
        const winningSide = winnerIndex ? [opponent] : [participant];
        const losingSide = winnerIndex ? [participant] : [opponent];
        const matchUp = {
          result: score,
          gender,
          losingSide,
          winningSide,
          groupNumber,
          roundName: "RR",
          matchType: SINGLES,
          drawPositions: [drawPosition, opponent.drawPosition],
        };
        return winnerIndex === 0 && matchUp;
      })
      .filter(Boolean);
    return { matchUps };
  }

  function getWinnerIndex(result) {
    if (result.indexOf("jn") === 0) {
      return { winnerIndex: 0, score: "W.O." };
    }
    if (result === "megsérült") {
      return { winnerIndex: 1, score: "W.O." };
    }
    if (result === "feladta") {
      return { winnerIndex: 1, score: "W.O." };
    }
    let score = normalizeScore(tidyScore(result));
    let testScore = normalizeScore(score.replace(/\([0-9]+\)/g, ""));
    const sets = testScore.split(" ");
    const wins = sets
      .map((set) => {
        let sideScores = set.split("-").map((s) => parseInt(s));
        return sideScores[0] > sideScores[1] ? 1 : 0;
      })
      .reduce((a, b) => a + b);
    let winnerIndex = wins > sets.length / 2 ? 0 : 1;
    return { winnerIndex, score };
  }

  function extractPlayer({ row, drawPosition, isDoubles }) {
    let player = { drawPosition };
    if (columns.seed) {
      const seedRow = isDoubles ? row + rowOffset : row;
      player.seed = numberValue(sheet, `${columns.seed}${seedRow}`);
    }

    let firstName = getCellValue(sheet[`${columns.firstName}${row}`]);
    let lastName = getCellValue(sheet[`${columns.lastName}${row}`]);
    let fullName =
      firstName && lastName
        ? `${lastName}, ${firstName}`
        : getCellValue(sheet[`${columns.players}${row}`]);

    if (extract_seed.test(fullName)) {
      player.seed = parseInt(extract_seed.exec(fullName)[1]);
      fullName = fullName.split("[")[0].trim();
    }

    player.full_name = fullName;
    player.last_first_i = lastFirstI(fullName);
    player.last_name = lastName || fullName.split(",")[0].trim().toLowerCase();
    player.first_name =
      firstName || fullName.split(",").reverse()[0].trim().toLowerCase();
    player.hash = nameHash(player.first_name + player.last_name);
    player.participantId = `${hashId(player.hash)}-P`;
    if (columns.id) {
      const cellReference = `${columns.id}${row}`;
      const value = getCellValue(sheet[cellReference]);
      player.personId = value.replace('"', "");
    }
    if (gender) player.gender = gender;
    if (columns.club)
      player.club = getCellValue(sheet[`${columns.club}${row}`]);
    if (columns.rank) player.rank = numberValue(sheet, `${columns.rank}${row}`);
    if (columns.entry)
      player.entry = getCellValue(sheet[`${columns.entry}${row}`]);
    if (columns.country)
      player.ioc = getCellValue(sheet[`${columns.country}${row}`]);
    if (columns.roundRobinResult)
      player.roundRobinResult = numberValue(
        sheet,
        `${columns.roundRobinResult}${row}`
      );

    return fullName ? player : undefined;
  }
}
