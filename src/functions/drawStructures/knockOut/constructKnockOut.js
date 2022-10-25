import { getRoundData } from "functions/drawStructures/drawFx";
import { normalizeDiacritics } from "normalize-text";
import {
  getColumnMatchUps,
  getExpectedRoundMatchUps,
} from "functions/drawStructures/knockOut/columnMatchUps";
import {
  chunkArray,
  instanceCount,
  unique,
  isPowerOf2,
  generateRange,
} from "functions/utilities";
import {
  constructMatchUps,
  constructPreroundMatches,
} from "functions/drawStructures/matchConstruction";

export function constructKnockOut({
  profile,
  sheet,
  columns,
  headerRow,
  gender,
  playerData,
  preround,
}) {
  const matchOutcomes = profile.matchOutcomes.map(normalizeDiacritics);
  const roundData = getRoundData({
    profile,
    sheet,
    columns,
    playerData,
    headerRow,
    matchOutcomes,
  });
  const players = playerData.players;
  const allDrawPositions = players
    .map((p) => p.drawPosition)
    .filter(removeUndefined);
  const uniqueDrawPositions = unique(allDrawPositions);
  const maxUniqueDrawPosition = Math.max(...uniqueDrawPositions);
  const maxIsOdd = maxUniqueDrawPosition % 2;
  const maxDrawPosition = maxUniqueDrawPosition + (maxIsOdd ? 1 : 0);
  const drawPositions = generateRange(1, maxDrawPosition + 1);

  // TODO: this may be insufficient for TP or HTS Doubles Draws
  const isDoubles =
    Math.max(...Object.values(instanceCount(allDrawPositions))) === 2;

  let expectedMatchUps = drawPositions.length / 2;
  let expectedGroupings = chunkArray(drawPositions, 2);

  let rounds = [];
  let matchUps = [];
  const isValidExpectedMatchUps = isPowerOf2(expectedMatchUps);
  if (!isValidExpectedMatchUps) {
    console.log("%c Invalid Expected MatchUps", "color: red");
    console.log({ drawPositions, expectedMatchUps, sheet });
    return { rounds, matchUps: [] };
  }

  let expectOutcomes = false;
  let expectedRowRanges = [];
  let playerRows = uniqueDrawPositions.map((drawPosition) => {
    const rows = players
      .filter((player) => player.drawPosition === drawPosition)
      .map((player) => player.row)
      .filter((p) => p);
    return Math.min(...rows);
  });
  expectedRowRanges = chunkArray(playerRows, 2);
  // console.log({players, playerRows, expectedRowRanges});

  roundData.forEach((round, i) => {
    const { roundMatchUps, embeddedMatchUps, allOutcomes } = getColumnMatchUps({
      sheet,
      round,
      players,
      isDoubles,
      matchOutcomes,
      expectOutcomes,
      expectedRowRanges,
      expectedGroupings,
    });
    rounds.push(roundMatchUps);

    const winnerDrawPositions = roundMatchUps.map(
      (matchUp) => matchUp.winningDrawPosition
    );
    const winnerRowNumbers = [].concat(
      ...roundMatchUps.map((matchUp) => matchUp.cellRow)
    );

    expectedMatchUps = expectedMatchUps / 2;
    expectedGroupings = chunkArray(winnerDrawPositions, 2);
    expectedRowRanges = chunkArray(winnerRowNumbers, 2);
    expectOutcomes = expectOutcomes || allOutcomes;

    const embeddedMatchUpsCount = embeddedMatchUps.length;
    if (embeddedMatchUpsCount) {
      generateRange(0, embeddedMatchUpsCount).forEach((_, i) => {
        const roundMatchUps = getExpectedRoundMatchUps({
          matchUps: embeddedMatchUps,
          expectedRowRanges,
          expectedGroupings,
          logging: true,
        });

        const winnerDrawPositions = roundMatchUps.map(
          (matchUp) => matchUp.winningDrawPosition
        );
        const winnerRowNumbers = [].concat(
          ...roundMatchUps.map((matchUp) => matchUp.cellRow)
        );

        expectedMatchUps = expectedMatchUps / 2;
        expectedGroupings = chunkArray(winnerDrawPositions, 2);
        expectedRowRanges = chunkArray(winnerRowNumbers, 2);

        if (roundMatchUps.length) {
          rounds.push(roundMatchUps);
        }
      });
    }
  });

  if (!rounds.length) {
    return { rounds, matchUps: [] };
  }

  /* reverse rounds to:
    - append first round to end
    - start identifying matchUps with Final
    - filter players with byes into 2nd round
  */
  rounds.reverse();
  rounds = addEntryRound(rounds, players);
  const { roundMatchUps, stage } = constructMatchUps({
    rounds,
    players,
    isDoubles,
  });

  // merge all rounds into list of matchUps
  matchUps = []
    .concat(...roundMatchUps)
    .filter((f) => f.losingSide && f.result);

  if (gender) {
    matchUps.forEach((match) => (match.gender = gender));
  }

  preround =
    playerData.preround && playerData.preround.matchUps
      ? constructPreroundMatches(rounds, playerData.preround, players, gender)
      : [];

  return { matchUps, stage, preround, isDoubles };
}

function addEntryRound(rounds, players) {
  let winnerDrawPositions = unique(
    [].concat(
      ...rounds.map((matchUps) =>
        matchUps.map((match) => match.winningDrawPosition).filter(Boolean)
      )
    )
  );
  let notWinner = (drawPosition) =>
    winnerDrawPositions.indexOf(drawPosition) < 0;
  let firstRoundLosers = players
    .filter((player) => notWinner(player.drawPosition))
    .map((m) => m.drawPosition)
    .filter((item, i, s) => s.lastIndexOf(item) === i)
    .map((m) => ({ players: [m] }));
  rounds.push(firstRoundLosers);
  return rounds;
}

function removeUndefined(entity) {
  return entity;
}
