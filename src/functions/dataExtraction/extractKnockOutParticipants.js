import { hashId } from "functions/utilities";
import { getColumnMatchUps } from "functions/drawStructures/knockOut/columnMatchUps";
import {
  getCellValue,
  numberValue,
  extractNameField,
} from "functions/dataExtraction/sheetAccess";
import {
  getRoundData,
  nameHash,
  lastFirstI,
} from "functions/drawStructures/drawFx";

export function extractKnockOutParticipants({
  profile,
  sheet,
  headerRow,
  columns,
  rows,
  range,
  gender,
  finals,
  preRoundRows,
}) {
  let playoff3rd = [];
  let playoff3rd_rows = [];
  let hasharray = [];

  const extract_seed = /\[(\d+)(\/\d+)?\]/;
  const rowOffset = profile.doubles.drawPosition.rowOffset;

  let isDoubles = false;

  // handle situation where doubles partners DON'T have drawPositions
  let doublesPartners = [];
  let expectedDrawPosition = 1;
  let positionedPlayers = [];
  let positionedPartners = [];
  let positionsAreOrdered = true;
  rows.forEach((row) => {
    const drawPosition = numberValue(sheet, `${columns.position}${row}`);
    const player = extractPlayer({ row, drawPosition, isDoubles });
    const playerHasName = player && player.full_name;
    const isExpected = drawPosition === expectedDrawPosition;
    const isPrevious = drawPosition === expectedDrawPosition - 1;
    if (isExpected) expectedDrawPosition++;

    positionsAreOrdered =
      (!drawPosition || isExpected || isPrevious) && positionsAreOrdered;
    if (isExpected && playerHasName) positionedPlayers.push(player);
    if (!drawPosition && playerHasName) positionedPartners.push(player);
    if (isPrevious && playerHasName) positionedPartners.push(player);
  });

  isDoubles =
    positionsAreOrdered &&
    positionedPlayers.length === positionedPartners.length;

  // handle situation where doubles partners DO have drawPositions
  let potentialPartner;
  expectedDrawPosition = 1;
  rows.forEach((row) => {
    let drawPosition = numberValue(sheet, `${columns.position}${row}`);
    let player = extractPlayer({ row, drawPosition, isDoubles });
    if (
      player.full_name &&
      (!drawPosition || drawPosition === expectedDrawPosition - 1)
    ) {
      potentialPartner = player;
    }
    if (drawPosition === expectedDrawPosition) {
      if (potentialPartner) {
        doublesPartners.push(potentialPartner);
        potentialPartner = undefined;
      }
      expectedDrawPosition++;
    }
  });
  if (doublesPartners.length) {
    isDoubles = true;
  }

  let players = [];
  expectedDrawPosition = 1;
  rows.forEach((row) => {
    let drawPosition = numberValue(sheet, `${columns.position}${row}`);

    if (!drawPosition && isDoubles) {
      drawPosition = numberValue(
        sheet,
        `${columns.position}${row + rowOffset}`
      );
    }

    let player = extractPlayer({ row, drawPosition, isDoubles });

    const isBye =
      ["bye,", "bye", "byebye"].indexOf(player.hash) >= 0 ||
      (player.hash === "" && drawPosition);
    const notBye = ["bye", "byebye"].indexOf(player.hash) < 0;
    const newPlayer = hasharray.indexOf(player.hash) < 0;
    const hasName = player.first_name && player.last_name;

    if (isBye) {
      player.isBye = true;
      player.full_name = "BYE";
      players.push(player);
      expectedDrawPosition = drawPosition + 1;
    } else if (notBye && newPlayer && hasName) {
      hasharray.push(player.hash);
      players.push(player);
      expectedDrawPosition = drawPosition + 1;
    } else if (drawPosition === expectedDrawPosition) {
      player.isBye = true;
      player.full_name = "BYE";
      players.push(player);
      expectedDrawPosition = drawPosition + 1;
    } else {
      playoff3rd_rows.push(row);
      playoff3rd.push(player);
    }
  });

  // rows from playoff round are excluded
  rows = rows.filter((row) => playoff3rd_rows.indexOf(row) < 0);
  range = [Math.min(0, ...rows), Math.max(0, ...rows)];

  let preround = { rows: [], players: [] };
  preRoundRows.forEach((row) => {
    let drawPosition = numberValue(sheet, `${columns.position}${row}`);

    let player = extractPlayer({ row, drawPosition });
    if (player.hash) {
      preround.rows.push(row);
      preround.players.push(player);
    }
  });

  preround.range = [
    Math.min(0, ...preround.rows),
    Math.max(0, ...preround.rows),
  ];
  let pdata = getRoundData({
    sheet,
    columns,
    headerRow,
    playerData: { players: preround.players, range: preround.range },
  });

  if (pdata[0] && pdata[0].columnReferences) {
    // there should be only one column of relevant data
    preround.matchUps = getColumnMatchUps({
      sheet,
      round: pdata[0],
      players: preround.players,
      isDoubles,
      rowOffset,
    }).matchUps.filter((match) => match.result);
  }

  return {
    players,
    rows,
    playoff3rd,
    playoff3rd_rows,
    range,
    finals,
    preround,
    isDoubles,
  };

  function extractPlayer({ row, drawPosition, isDoubles }) {
    let player = { drawPosition, row };
    if (columns.seed) {
      const seedRow = isDoubles ? row + rowOffset : row;
      player.seed = numberValue(sheet, `${columns.seed}${seedRow}`);
    }

    let firstName = extractNameField(sheet[`${columns.firstName}${row}`]);
    let lastName = extractNameField(sheet[`${columns.lastName}${row}`]);
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
    return player;
  }
}
