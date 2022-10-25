import { util } from "./util";
import { staging } from "./staging";
import { stringFx } from "./stringFx";
import { cleanScore } from "../functions/cleanScore";

export const tournamentParser = (function () {
  let tp = function () {};

  tp.verbose = undefined;

  /* tables */
  var draw_byes = {
    12: [1, 4, 9, 12],
    24: [1, 6, 7, 12, 13, 18, 19, 24],
    48: [1, 6, 7, 12, 13, 18, 19, 24, 25, 30, 31, 36, 37, 42, 43, 48],
  };
  var mainDrawRoundNames = [
    "F",
    "SF",
    "QF",
    "R16",
    "R32",
    "R64",
    "R128",
    "R256",
  ];

  tp.config = {
    // eslint-disable-next-line no-useless-escape
    score: /[\d\(]+[\d\.\(\)\[\]\\ \:\-\,\/O]+(Ret)?(ret)?(RET)?[\.]*$/,
    ended: [
      "ret.",
      "RET",
      "DEF.",
      "Def.",
      "def.",
      "BYE",
      "w.o",
      "w.o.",
      "W.O",
      "W.O.",
      "wo.",
      "WO",
      "Abandoned",
    ],
  };

  tp.normalizeScore = (score) => {
    let clean_score = cleanScore.normalize(score);
    if (clean_score) return clean_score.join(" ");
    alert(`Score can't be normalized: ${score}`);
    return score;
  };

  tp.profiles = {
    TP: {
      identification: {
        includes: ["WS", "WD", "MS", "MD"],
        sub_includes: ["BS", "BD", "GS", "GD"],
      },
      columns: {
        position: "A",
        rank: "C",
        players: "E",
        country: "D",
        rounds: "F",
      },
      rows: { header: 4 },
      gaps: { draw: { term: "Round 1", gap: 0 } },
      header_columns: [
        { attr: "id", header: "Member ID" },
        { attr: "entry", header: "St." },
        { attr: "club", header: "Club" },
        { attr: "country", header: "Cnty" },
        { attr: "rank", header: "Rank" },
        { attr: "players", header: "Round 1" },
      ],
      player_rows: { player_names: true },
      extraneous: {},
      routines: {},
    },
  };

  tp.dateProcess = {};

  const range = (start, end) =>
    Array.from({ length: end - start }, (v, k) => k + start);
  /* parsing */
  let unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) === i);
  let includes = (list, elements) =>
    elements.map((e) => list.indexOf(e) >= 0).reduce((a, b) => a || b);
  let subInclude = (list, elements) =>
    list.map((e) => includes(e, elements)).reduce((a, b) => a || b);
  let findMiddle = (arr) => arr[Math.round((arr.length - 1) / 2)];
  let findMiddles = (arr, number) => {
    if (!(arr.length % 2)) return [];
    let parts = [arr.slice()];
    let middles;
    while (number) {
      middles = [];
      let more_parts = [];
      // eslint-disable-next-line
      parts.forEach((part) => {
        let middle = findMiddle(part);
        middles.push(middle);
        more_parts.push(part.slice(0, middle));
        more_parts.push(part.slice(middle + 1));
        parts = more_parts;
      });
      number--;
    }
    return middles;
  };

  let getValue = (sheet, reference) => tp.value(sheet[reference]);
  let numberValue = (sheet, reference) =>
    !isNaN(parseInt(getValue(sheet, reference)))
      ? parseInt(getValue(sheet, reference))
      : "";
  let letterValue = (letter) => parseInt(letter, 36) - 9;
  let getRow = (reference) =>
    reference ? parseInt(/\d+/.exec(reference)[0]) : undefined;
  let getCol = (reference) => (reference ? reference[0] : undefined);
  let findValueRefs = (search_text, sheet) =>
    Object.keys(sheet).filter((ref) => tp.value(sheet[ref]) === search_text);
  let validRanking = (value) => /^\d+$/.test(value) || /^MR\d+$/.test(value);
  let inDrawColumns = (ref, round_columns) =>
    round_columns.indexOf(ref[0]) >= 0;
  let inDrawRows = (ref, range) =>
    getRow(ref) >= +range[0] && getRow(ref) <= +range[1];
  let cellsContaining = ({ sheet, term }) => {
    let references = Object.keys(sheet);
    return references.filter(
      (ref) =>
        (sheet[ref].v + "").toLowerCase().indexOf(term.toLowerCase()) >= 0
    );
  };

  let findGaps = ({ sheet, term }) => {
    let gaps = [];
    let gap_start = 0;
    let instances = cellsContaining({ sheet, term })
      .map((reference) => getRow(reference))
      .filter((item, i, s) => s.lastIndexOf(item) === i);
    instances.unshift(0);
    let nextGap = (index) => {
      while (
        +instances[index + 1] === +instances[index] + 1 &&
        index < instances.length
      ) {
        index += 1;
      }
      return index;
    };
    let gap_end = nextGap(0);
    while (gap_end < instances.length) {
      if (gap_start) gaps.push([instances[gap_start], instances[gap_end]]);
      gap_start = nextGap(gap_end);
      gap_end = nextGap(gap_start + 1);
    }
    // only accept gaps which are considered to be "main page body"
    gaps = gaps.filter((f) => f[1] - f[0] > 3);
    return gaps;
  };

  let extraneousData = (sheet, ref) => {
    let value = sheet[ref].v;
    if (!isNaN(value) && value < 16) return true;
    let extraneous = tp.profiles[tp.profile].extraneous;
    if (extraneous && extraneous.starts_with) {
      let cellValue = tp.value(sheet[ref]) + "";
      return extraneous.starts_with
        .map((s) => cellValue.toLowerCase().indexOf(s) === 0)
        .reduce((a, b) => a || b);
    }
  };

  let scoreOrPlayer = ({ cellValue, players }) => {
    // TODO: more robust way of handling 'nije igrano' or 'not recorded' situations
    if (cellValue === "not recorded") return true;
    // if (cellValue === 'nije igrano') return true; // really broken way of working around situation where final match not played
    let drawPosition = tp.drawPosition({ full_name: cellValue, players });
    if (drawPosition) return true;
    let score = cellValue.match(tp.config.score);
    if (score && score[0] === cellValue) return true;
    let ended = tp.config.ended
      .map(
        (ending) => cellValue.toLowerCase().indexOf(ending.toLowerCase()) >= 0
      )
      .reduce((a, b) => a || b);
    if (ended) return true;

    if (tp.verbose) console.log("Not Score or Player:", cellValue);
    return false;
  };

  let lastFirstI = (name) => {
    if (name.indexOf(",") >= 0) {
      let components = name
        .toLowerCase()
        .split(",")
        .map((m) => m.trim());
      let lfi = components[1] ? `${components[0]}, ${components[1][0]}` : "";
      return lfi;
    }
    let components = name
      .toLowerCase()
      .split("[")[0]
      .split(" ")
      .filter(Boolean);
    let lfi = components.length
      ? `${components[0][0]}, ${components.reverse()[0]}`
      : "";
    return lfi;
  };

  tp.headerColumns = ({ sheet }) => {
    let profile = tp.profiles[tp.profile];
    if (!profile) return [];
    let columns = Object.assign({}, profile.columns);
    if (profile.header_columns) {
      profile.header_columns.forEach((obj) => {
        let col = getCol(findValueRefs(obj.header, sheet)[0]);
        if (col) columns[obj.attr] = col;
      });
    }
    return columns;
  };

  /* exportable functions */
  tp.value = (cell) => {
    let val = cell ? cell.v + "" : "";
    // return (typeof val === 'string') ? val.trim() : val;
    val = typeof val === "string" ? val.trim() : val;
    val = val.indexOf(",,") >= 0 ? val.replace(",,", ",") : val;
    val =
      val.indexOf(",") >= 0
        ? val
            .split(",")
            .map((v) => v.trim())
            .join(", ")
        : val;
    return val;
  };

  tp.playerRows = ({ sheet }) => {
    let profile = tp.profiles[tp.profile];
    if (!profile) return { rows: [], preRoundRows: [] };
    let columns = tp.headerColumns({ sheet });

    let roundRobinResult = [];
    let player_names = Object.keys(sheet)
      .filter(
        (f) => f[0] === columns.players && getRow(f) > profile.rows.header
      )
      .filter(
        (f) => tp.value(sheet[f]) && typeof tp.value(sheet[f]) === "string"
      )
      .map((f) => getRow(f));
    let draw_positions = Object.keys(sheet)
      .filter(
        (f) =>
          f[0] === columns.position &&
          /\d/.test(f[1]) &&
          /^\d+(a)?$/.test(tp.value(sheet[f]))
      )
      .map((ref) => getRow(ref));
    let rankings = Object.keys(sheet)
      .filter(
        (f) =>
          f[0] === columns.rank &&
          /\d/.test(f[1]) &&
          validRanking(tp.value(sheet[f]))
      )
      .map((ref) => getRow(ref));
    let finals;

    // check whether this is Round Robin
    if (columns.roundRobinResult) {
      roundRobinResult = Object.keys(sheet)
        // eslint-disable-next-line no-useless-escape
        .filter(
          (f) =>
            f[0] === columns.roundRobinResult &&
            /\d/.test(f[1]) &&
            /^\d+[\.]*$/.test(tp.value(sheet[f]))
        )
        .map((ref) => getRow(ref));
      rankings = rankings.filter((f) => roundRobinResult.indexOf(f) >= 0);
    }

    let sources = [draw_positions, rankings, roundRobinResult];

    // Necessary for finding all player rows in TP Doubles Draws
    if (profile.player_rows && profile.player_rows.player_names) {
      let additions = [];
      player_names.forEach((f) => {
        // additions is just a counter
        if (tp.value(sheet[`${columns.players}${f}`]).toLowerCase() === "bye")
          additions.push(f - 1);
      });
      sources.push(player_names);
    }

    let rows = []
      .concat(...sources)
      .filter((item, i, s) => s.lastIndexOf(item) === i)
      .sort((a, b) => a - b);

    let drawRows; // must be undefined for RR to work!
    let preRoundRows = [];

    if (profile.gaps && profile.gaps.draw) {
      let gaps = findGaps({ sheet, term: profile.gaps["draw"].term });

      if (gaps.length) {
        let gap = gaps[profile.gaps["draw"].gap];
        if (!columns.roundRobinResult) {
          // filter rows by gaps unless Round Robin Results Column
          drawRows = rows.filter((row) => row > gap[0] && row < gap[1]);
        } else {
          // names that are within gap in round robin
          finals = player_names.filter((row) => row > gap[0] && row < gap[1]);
        }

        if (gaps.length > 1) {
          let gap = gaps[profile.gaps["preround"].gap];
          preRoundRows = rows.filter((row) => row > gap[0] && row < gap[1]);
        }
      }
    }

    drawRows = drawRows || rows;
    let range = [drawRows[0], drawRows[drawRows.length - 1]];

    // determine whether there are player rows outside of Round Robins
    finals = finals ? finals.filter((f) => drawRows.indexOf(f) < 0) : undefined;
    finals = finals && finals.length ? finals : undefined;

    return { rows: drawRows, range, finals, preRoundRows };
  };

  tp.roundColumns = ({ sheet }) => {
    let profile = tp.profiles[tp.profile];
    if (!profile) return [];
    let header_row = profile.rows.header;
    let rounds_column = profile.columns.rounds;
    let columns = Object.keys(sheet)
      // key.slice(1) is meant to strip away the alpha part of the column
      // name... won't work if column is for instance AA23... so a more robust
      // function would be better!
      .filter(
        (key) =>
          key.length === 2 &&
          +key.slice(1) === +header_row &&
          letterValue(key[0]) >= letterValue(rounds_column)
      )
      .map((m) => m[0])
      .filter((item, i, s) => s.lastIndexOf(item) === i)
      .sort();
    return columns;
  };

  tp.getRoundData = ({ sheet, player_data, round_robin }) => {
    let rr_columns;
    let players = player_data.players;
    let round_columns = tp.roundColumns({ sheet });
    let range = player_data.range;
    let cell_references = Object.keys(sheet)
      .filter(
        (ref) => inDrawColumns(ref, round_columns) && inDrawRows(ref, range)
      )
      .filter((ref) => !extraneousData(sheet, ref));
    // .filter(ref => ['I29', 'I30'].indexOf(ref) < 0)

    let filtered_columns = round_columns
      .map((column) => {
        let column_references = cell_references
          .filter((ref) => ref[0] === column)
          .filter((ref) =>
            scoreOrPlayer({ cellValue: tp.value(sheet[ref]), players })
          );
        return { column, column_references };
      })
      .filter((f) => f.column_references.length);

    // work around for round robins with blank 'BYE' columns
    if (filtered_columns.length) {
      let start = round_columns.indexOf(filtered_columns[0].column);
      let end = round_columns.indexOf(
        filtered_columns[filtered_columns.length - 1].column
      );
      let column_range = round_columns.slice(start, end);
      rr_columns = column_range.map((column) => {
        let column_references = cell_references
          .filter((ref) => ref[0] === column)
          .filter((ref) =>
            scoreOrPlayer({ cellValue: tp.value(sheet[ref]), players })
          );
        return { column, column_references };
      });
    }

    return round_robin ? rr_columns : filtered_columns;
  };

  tp.drawPlayers = ({ sheet }) => {
    let extract_seed = /\[(\d+)(\/\d+)?\]/;
    let columns = tp.headerColumns({ sheet });

    let { rows, range, finals, preRoundRows } = tp.playerRows({ sheet });

    let players = [];
    let playoff3rd = [];
    let playoff3rd_rows = [];
    let hasharray = [];

    rows.forEach((row) => {
      let drawPosition = numberValue(sheet, `${columns.position}${row}`);

      // MUST BE DOUBLES
      if (!drawPosition)
        drawPosition = numberValue(sheet, `${columns.position}${row + 1}`);

      let player = extractPlayer(row, drawPosition);

      if (["", "bye", "byebye"].indexOf(player.hash) >= 0) {
        players.push(player);
      } else if (
        ["", "bye", "byebye"].indexOf(player.hash) < 0 &&
        hasharray.indexOf(player.hash) < 0
      ) {
        hasharray.push(player.hash);
        players.push(player);
      } else {
        playoff3rd_rows.push(row);
        playoff3rd.push(player);
      }
    });

    // rows from playoff round are excluded
    rows = rows.filter((row) => playoff3rd_rows.indexOf(row) < 0);
    range = [Math.min(...rows), Math.max(...rows)];

    let preround = { rows: [], players: [] };
    preRoundRows.forEach((row) => {
      let drawPosition = numberValue(sheet, `${columns.position}${row}`);

      let player = extractPlayer(row, drawPosition);
      if (player.hash) {
        preround.rows.push(row);
        preround.players.push(player);
      }
    });

    preround.range = [Math.min(...preround.rows), Math.max(...preround.rows)];
    let pdata = tp.getRoundData({
      sheet,
      player_data: { players: preround.players, range: preround.range },
    });

    if (pdata[0] && pdata[0].column_references) {
      // there should be only one column of relevant data
      preround.matches = getColumnMatchUps(
        sheet,
        pdata[0],
        preround.players
      ).matches.filter((match) => match.result);
    }

    return {
      players,
      rows,
      playoff3rd,
      playoff3rd_rows,
      range,
      finals,
      preround,
    };

    function extractPlayer(row, drawPosition) {
      let player = { drawPosition };
      if (columns.seed)
        player.seed = numberValue(sheet, `${columns.seed}${row}`);

      let full_name = getValue(sheet, `${columns.players}${row}`);
      if (extract_seed.test(full_name)) {
        player.seed = parseInt(extract_seed.exec(full_name)[1]);
        full_name = full_name.split("[")[0].trim();
      }

      player.full_name = full_name;
      player.last_first_i = lastFirstI(full_name);
      player.last_name = full_name.split(",")[0].trim().toLowerCase();
      player.first_name = full_name
        .split(",")
        .reverse()[0]
        .trim()
        .toLowerCase();
      player.hash = stringFx.nameHash(player.first_name + player.last_name);
      if (columns.id) player.id = getValue(sheet, `${columns.id}${row}`);
      if (columns.club) player.club = getValue(sheet, `${columns.club}${row}`);
      if (columns.rank)
        player.rank = numberValue(sheet, `${columns.rank}${row}`);
      if (columns.entry)
        player.entry = getValue(sheet, `${columns.entry}${row}`);
      if (columns.country)
        player.ioc = getValue(sheet, `${columns.country}${row}`);
      if (columns.roundRobinResult)
        player.roundRobinResult = numberValue(
          sheet,
          `${columns.roundRobinResult}${row}`
        );
      return player;
    }
  };

  tp.drawPosition = ({ full_name, players, idx = 0 }) => {
    // idx used in instances where there are multiple BYEs, such that they each have a unique drawPosition
    let tournament_player = players.filter(
      (player) =>
        player.full_name &&
        stringFx.normalizeDiacritics(player.full_name) ===
          stringFx.normalizeDiacritics(full_name)
    )[idx];
    if (!tournament_player) {
      // find player draw position by last name, first initial; for draws where first name omitted after first round
      tournament_player = players.filter(
        (player) =>
          player.last_first_i && player.last_first_i === lastFirstI(full_name)
      )[0];
    }
    return tournament_player ? tournament_player.drawPosition : undefined;
  };

  let getColumnMatchUps = (sheet, round, players) => {
    let names = [];
    let matches = [];
    let winners = [];
    let last_draw_position;
    let round_occurrences = [];
    let last_row_number = getRow(round.column_references[0]) - 1;
    round.column_references.forEach((reference) => {
      // if row number not sequential => new match
      let this_row_number = getRow(reference);
      if (+this_row_number !== +last_row_number + 1 && winners.length) {
        if (last_draw_position) {
          // keep track of how many times draw position occurs in column
          if (!round_occurrences[last_draw_position])
            round_occurrences[last_draw_position] = [];
          round_occurrences[last_draw_position].push(matches.length);
        }
        matches.push({ winners });
        winners = [];
      }
      last_row_number = this_row_number;

      let cellValue = tp.value(sheet[reference]);
      let idx = names.filter(Boolean === cellValue).length;
      // names used to keep track of duplicates, i.e. 'BYE' such that
      // a unique drawPosition is returned for subsequent byes
      names.push(cellValue);
      let drawPosition = tp.drawPosition({
        full_name: cellValue,
        players,
        idx,
      });

      // cellValue is a draw position => round winner(s)
      if (drawPosition !== undefined) {
        last_draw_position = drawPosition;
        if (winners.indexOf(drawPosition) < 0) winners.push(drawPosition);
      } else {
        // cellValue is not draw position => match score
        if (last_draw_position) {
          // keep track of how many times draw position occurs in column
          if (!round_occurrences[last_draw_position])
            round_occurrences[last_draw_position] = [];
          round_occurrences[last_draw_position].push(matches.length);
        }
        matches.push({ winners, result: tp.normalizeScore(cellValue) });
        winners = [];
      }
    });
    // still winners => last column match had a bye
    if (winners.length) matches.push({ bye: winners });
    round_occurrences = round_occurrences
      .map((indices, drawPosition) => ({ drawPosition, indices }))
      .filter(Boolean);
    return { round_occurrences, matches };
  };

  let addByes = (rounds, players) => {
    let profile = tp.profiles[tp.profile];
    if (!profile) return [];
    if (
      draw_byes[players.length] &&
      profile.routines &&
      profile.routines.add_byes
    ) {
      let round_winners = [].concat(
        ...rounds[0].map((match) => match.winners).filter(Boolean)
      );
      draw_byes[players.length].forEach((player) => {
        if (round_winners.indexOf(player) < 0)
          rounds[0].push({ bye: [player] });
      });
      rounds[0].sort((a, b) => {
        let adp = a.winners ? a.winners[0] : a.bye[0];
        let bdp = b.winners ? b.winners[0] : b.bye[0];
        return adp - bdp;
      });
    } else {
      draw_byes[players.length] = [];
    }
    return rounds;
  };

  let add1stRound = (rounds, players) => {
    // 1st round players are players without byes or wins
    let winners = unique(
      [].concat(
        ...rounds.map((matches) =>
          [].concat(...matches.map((match) => match.winners).filter(Boolean))
        )
      )
    );
    let notWinner = (drawPosition) => winners.indexOf(drawPosition) < 0;
    let notBye = (drawPosition) =>
      !draw_byes[players.length] ||
      draw_byes[players.length].indexOf(drawPosition) < 0;
    let first_round_losers = players
      .filter(
        (player) =>
          notWinner(player.drawPosition) && notBye(player.drawPosition)
      )
      .map((m) => m.drawPosition)
      .filter((item, i, s) => s.lastIndexOf(item) === i)
      .map((m) => ({ players: [m] }));
    rounds.push(first_round_losers);
    return rounds;
  };

  let findEmbeddedRounds = (rounds) => {
    let embedded_rounds = [];
    rounds.forEach((round) => {
      let embedded = round.round_occurrences.filter(
        Boolean.indices.length > 1
      ).length;
      if (embedded) {
        let other_rounds = [];
        // let indices = [...Array(round.matches.length)].map((_, i) => i);
        let indices = util.numArr(round.matches.length);
        for (let i = embedded; i > 0; i--) {
          let embedded_indices = findMiddles(indices, i);
          if (embedded_indices.length) {
            other_rounds = other_rounds.concat(...embedded_indices);
            embedded_rounds.push({
              matches: embedded_indices.map((match_index) =>
                Object.assign({}, round.matches[match_index])
              ),
            });
            embedded_indices.forEach(
              (match_index) => (round.matches[match_index].result = undefined)
            );
          }
        }
        // filter out embedded matches
        round.matches = round.matches.filter((match) => match.result);
      }
    });
    return embedded_rounds;
  };

  let constructPreroundMatches = (rounds, preround, players, gender) => {
    let round_winners = [];
    let round_name = mainDrawRoundNames[rounds.length - 1];
    let draw_positions = preround.players.map((p) => p.drawPosition);

    // draw position offset
    let dpo = Math.min(...draw_positions) - 1;

    preround.matches.forEach((match) => round_winners.push(match.winners[0]));
    let winning_players = preround.players.filter(
      (player) => round_winners.indexOf(player.drawPosition) >= 0
    );
    let eliminated_players = preround.players.filter(
      (player) => round_winners.indexOf(player.drawPosition) < 0
    );
    preround.matches.forEach((match, match_index) => {
      match.round_name = round_name;
      match.loser_names = [eliminated_players[match_index].full_name];
      match.losers = [eliminated_players[match_index].drawPosition - dpo];
      match.winner_names = [winning_players[match_index].full_name];

      let winner_data = winning_players[match_index];
      let winner_details = players
        .filter((p) => p.full_name === winner_data.full_name)
        .reduce((a, b) => a && b);
      if (!winner_details) alert("Pre-round Parsing Error");
      if (winner_details)
        match.main_draw_position = [winner_details.drawPosition];
      if (gender) match.gender = gender;
    });
    return preround.matches;
  };

  let constructMatchUps = (rounds, players) => {
    // less broken way of working around situation where final match not played
    let draw_type =
      rounds[0].length === 1 ||
      (rounds[0].length === 2 && rounds[1].length === 4)
        ? "main"
        : "qualification";

    // really broken way of working around situation where final match not played
    // if (rounds[0][0].result === 'nije igrano') rounds = rounds.slice(1);

    rounds.forEach((round, index) => {
      if (+index + 2 === rounds.length)
        round = round.filter((player) => player.bye === undefined);
      if (index + 1 < rounds.length) {
        let round_matches = [];
        let round_winners = [];
        round.forEach((match) => {
          let player = match.winners
            ? match.winners[0]
            : match.bye
            ? match.bye[0]
            : match.players[0];
          round_winners.push(player);
          round_matches.push(match);
        });
        let previous_round_players = rounds[index + 1].map((match) => {
          return match.winners
            ? match.winners[0]
            : match.bye
            ? match.bye[0]
            : match.players[0];
        });
        let eliminated_players = previous_round_players.filter(
          (player) => round_winners.indexOf(player) < 0
        );
        let draw_positions = players
          .map((m) => m.drawPosition)
          .filter((item, i, s) => s.lastIndexOf(item) === i).length;
        let round_name =
          index + 2 < rounds.length || index < 3
            ? mainDrawRoundNames[index]
            : `R${draw_positions}`;
        round_matches.forEach((match, match_index) => {
          match.round_name =
            draw_type === "main" ? round_name : `Q${index || ""}`;
          match.losers = [eliminated_players[match_index]];
          match.loser_names = players
            .filter((f) => +f.drawPosition === +eliminated_players[match_index])
            .map((p) => p.full_name);
        });
      }
    });
    return rounds;
  };

  let findPlayerAtDrawPosition = (players, start, goal, direction) => {
    let index = start + direction;
    while (
      players[index] &&
      +players[index].drawPosition !== +goal &&
      index < players.length &&
      index >= 0
    ) {
      index += direction;
    }
    if (!players[index]) return undefined;
    return index;
  };

  let determineWinner = (score) => {
    let tally = [0, 0];
    let set_scores = score.split(" ");
    set_scores.forEach((set_score) => {
      // eslint-disable-next-line no-useless-escape
      let scores = /\d+[\(\)\-\/]*/.test(set_score)
        ? set_score.split("-").map((s) => /\d+/.exec(s)[0])
        : undefined;
      if (scores) tally[parseInt(scores[0]) > parseInt(scores[1]) ? 0 : 1] += 1;
    });

    if (tally[0] > tally[1]) return 0;
    if (tally[1] > tally[0]) return 1;
    return undefined;
  };

  let reverseScore = (score, split = " ") => {
    return score
      .split(split)
      .map((set_score) => {
        let tiebreak = /\((\d+)\)/.exec(set_score);
        let score = set_score.split("(")[0];
        let scores = /\d+/.test(score)
          ? score.split("").reverse().join("")
          : score;
        if (tiebreak) scores += `${tiebreak[0]}`;
        return scores;
      })
      .join(split);
  };

  tp.tournamentDraw = ({ sheet_name, sheet, player_data }) => {
    let gender = "";
    let rounds = [];
    let matches = [];
    let preround = [];
    player_data = player_data || tp.drawPlayers({ sheet });

    let players = player_data.players;
    let round_robin = players.length
      ? players
          .map((p) => p.roundRobinResult !== undefined)
          .reduce((a, b) => a || b)
      : false;
    let qualifying = sheet_name.indexOf("Q") >= 0;

    if (
      sheet_name.indexOf("BS") === 0 ||
      sheet_name.indexOf("BD") === 0 ||
      sheet_name.indexOf("MS") === 0 ||
      sheet_name.indexOf("MD") === 0
    ) {
      gender = "M";
    } else if (
      sheet_name.indexOf("GS") === 0 ||
      sheet_name.indexOf("GD") === 0 ||
      sheet_name.indexOf("WD") === 0 ||
      sheet_name.indexOf("WS") === 0
    ) {
      gender = "W";
    }

    if (tp.value(sheet["A2"]).toLowerCase().indexOf("djevojčice") >= 0)
      gender = "W";
    if (tp.value(sheet["A2"]).toLowerCase().indexOf("dječaci") >= 0) {
      gender = "M";
    }

    if (round_robin) {
      let hash = [];
      let player_rows = player_data.rows;
      let pi = player_data.players
        .map((p, i) => (p.roundRobinResult ? i : undefined))
        .filter((f) => f !== undefined);
      let group_size = pi.length;

      // combine all cell references that are in result columns
      let round_data =
        tp.getRoundData({ sheet, player_data, round_robin: true }) || [];
      let rr_columns = round_data.map((m) => m.column).slice(0, group_size);
      let result_references = [].concat(
        ...round_data.map((round, index) =>
          index < group_size ? round.column_references : []
        )
      );
      player_rows.forEach((player_row, player_index) => {
        let player_result_referencess = result_references.filter(
          (ref) => +ref.slice(1) === +player_row
        );
        player_result_referencess.forEach((reference) => {
          let result_column = reference[0];
          let player_draw_position = players[player_index].drawPosition;
          let opponent_draw_position = rr_columns.indexOf(result_column) + 1;
          let direction =
            opponent_draw_position > player_draw_position ? 1 : -1;
          let opponent_index = findPlayerAtDrawPosition(
            players,
            player_index,
            opponent_draw_position,
            direction
          );
          let result = tp.normalizeScore(tp.value(sheet[reference]));
          let match_winner = determineWinner(result);
          let loser = +match_winner === 1 ? player_index : opponent_index;
          let winner = +match_winner === 1 ? opponent_index : player_index;

          let loser_draw_position = match_winner
            ? player_draw_position
            : opponent_draw_position;
          let winner_draw_position = match_winner
            ? opponent_draw_position
            : player_draw_position;

          if (players[loser] && players[winner] && match_winner !== undefined) {
            let round =
              "RR" + (qualifying ? "Q" : "") + players[winner].roundRobinResult;
            if (match_winner) result = reverseScore(result);
            let match = {
              winner_names: [players[winner].full_name],
              winner_draw_position,
              loser_names: [players[loser].full_name],
              loser_draw_position,
              gender: gender,
              round,
              result,
            };

            // don't add the same match twice
            if (hash.indexOf(`${winner}${loser}${result}`) < 0) {
              hash.push(`${winner}${loser}${result}`);
              matches.push(match);
            }
          }
        });
      });

      // also search for final match in single-page RR sheet
      let profile = tp.profiles[tp.profile];
      if (
        profile &&
        player_data.finals &&
        profile.targets &&
        profile.targets.winner
      ) {
        let keys = Object.keys(sheet);
        let columns = tp.headerColumns({ sheet });
        console.log(
          "do these values need to be coerced to ints?",
          profile.targerts.winner
        );
        let target = unique(
          keys.filter((f) => tp.value(sheet[f]) === profile.targets.winner)
        )[0];
        if (target && target.match(/\d+/)) {
          let finals_col = target[0];
          let finals_row = parseInt(target.match(/\d+/)[0]);
          let finals_range = player_data.finals.filter(
            (f) => +f !== +finals_row
          );
          let finals_cells = keys
            .filter((k) => {
              let numeric = k.match(/\d+/);
              if (!numeric) return false;
              // do these values need to be coerced to ints?
              return (
                numeric[0] >= finals_range[0] &&
                numeric[0] <= finals_range[finals_range.length - 1] &&
                k[0] === finals_col
              );
            })
            .filter((ref) =>
              scoreOrPlayer({ cellValue: tp.value(sheet[ref]), players })
            );
          let finals_details = finals_cells.map((fc) => tp.value(sheet[fc]));
          let finalists = player_data.finals
            .map((row) => getValue(sheet, `${columns.players}${row}`))
            .filter((player) => scoreOrPlayer({ cellValue: player, players }));
          let winner = finals_details.filter(
            (f) => finalists.indexOf(f) >= 0
          )[0];
          let result = finals_details.filter(
            (f) => finalists.indexOf(f) < 0
          )[0];
          let loser = finalists.filter((f) => +f !== +winner)[0];
          if (result) {
            let match = {
              winner_names: [winner],
              loser_names: [loser],
              round: "RRF",
              result: tp.normalizeScore(result),
              gender: gender,
            };
            matches.push(match);
          }
        }
      }
    } else {
      let first_round;
      let round_data = tp.getRoundData({ sheet, player_data });
      rounds = round_data.map((round) => {
        let columnMatchUps = getColumnMatchUps(sheet, round, players);
        let matches_with_results = columnMatchUps.matches.filter(
          (match) => match.result
        );

        if (!matches_with_results.length) {
          // first_round necessary for situations where i.e. 32 draw used when 16 would suffice
          first_round = columnMatchUps.matches
            .filter((match) => match.winners)
            .map((match) => match.winners[0]);
        }
        return columnMatchUps;
      });
      findEmbeddedRounds(rounds).forEach((round) => rounds.push(round));
      rounds = rounds.map((round) => round.matches);
      if (!rounds.length) {
        if (tp.verbose)
          console.log(
            "ERROR WITH SHEET - Possibly abandoned.",
            tp.profile,
            "format."
          );
        return { rounds, matches: [] };
      }
      rounds = addByes(rounds, players);
      /* reverse rounds to:
            - append first round to end
            - start identifying matches with Final
            - filter players with byes into 2nd round
         */
      rounds.reverse();

      if (first_round) {
        let filtered_players = players.filter(
          (player) => first_round.indexOf(player.drawPosition) >= 0
        );
        rounds = add1stRound(rounds, filtered_players);
      } else {
        rounds = add1stRound(rounds, players);
      }
      rounds = rounds.filter(
        (round) =>
          round.filter((f) => (f.winners ? f.winners.length : true)).length
      );
      rounds = constructMatchUps(rounds, players);

      // merge all rounds into list of matches
      matches = [].concat(...rounds).filter((f) => f.losers && f.result);

      // add player names to matches
      matches.forEach(
        (match) =>
          (match.winner_names = players
            .filter((f) => +f.drawPosition === +match.winners[0])
            .map((p) => p.full_name))
      );
      if (gender) matches.forEach((match) => (match.gender = gender));

      preround = player_data.preround.matches
        ? constructPreroundMatches(
            rounds,
            player_data.preround,
            players,
            gender
          )
        : [];

      if (player_data.playoff3rd && player_data.playoff3rd.length) {
        if (tp.verbose) console.log("constructing 3rd place match");

        // 3rd place playoff column should be the first round result column
        let result_column = tp.roundColumns({ sheet })[0];
        // create a range from the minimum and maximum playoff rows
        let result_range = range(
          Math.min(...player_data.playoff3rd_rows),
          Math.max(...player_data.playoff3rd_rows) + 1
        );
        // accumulate all values for the result range and filter for score or player
        let result = result_range
          .map((row) => tp.value(sheet[`${result_column}${row}`]))
          .filter(Boolean)
          .filter((cellValue) => scoreOrPlayer({ cellValue, players }));
        //
        let players3rd = player_data.playoff3rd
          .map((player) => {
            return {
              full_name: player.full_name,
              drawPosition: tp.drawPosition({
                full_name: player.full_name,
                players,
              }),
            };
          })
          .filter((f) => f.drawPosition);
        // winner is the value that has a draw position
        let winners = result
          .map((cellValue) => {
            return {
              full_name: cellValue,
              drawPosition: tp.drawPosition({ full_name: cellValue, players }),
            };
          })
          .filter((f) => f.drawPosition);
        // winners are identified by their draw positions
        let winners_dp = winners.map((w) => w.drawPosition);
        let losers = players3rd.filter(
          (p) => winners_dp.indexOf(p.drawPosition) < 0
        );

        // score is the value that matches regex for scores
        let score = result.filter((cellValue) => {
          let s = cellValue.match(tp.config.score);
          if (s && s[0] === cellValue) return true;

          let ended = tp.config.ended
            .map(
              (ending) =>
                cellValue.toLowerCase().indexOf(ending.toLowerCase()) >= 0
            )
            .reduce((a, b) => a || b);
          if (ended) return true;
          return false;
        });
        if (winners.length > 0 && score.length === 1) {
          let match = {
            winners: winners_dp,
            winner_names: winners.map((w) => w.full_name),
            losers: losers.map((l) => l.drawPosition),
            loser_names: losers.map((l) => l.full_name),
            result: score[0],
            round: "PO3",
            gender: gender,
          };
          matches.push(match);
        }
      }
    }

    let draw = { rounds, matches, preround };
    let number = /\d+/;
    let rank_override = tp.value(sheet["Q5"]);
    if (
      rank_override &&
      rank_override.indexOf("rang") >= 0 &&
      number.test(rank_override)
    ) {
      draw.rank = +rank_override.match(/\d+/)[0];
    }

    console.log("Gender:", gender);
    return draw;
  };

  tp.drawResults = (workbook, tuid) => {
    let rows = [];
    let ranks = {};
    let categories = [];
    tp.setWorkbookProfile({ workbook });

    let parsing_errors;
    let tournament_rank;
    let tournament_category;
    let tournament_data = [];
    // tournament_data = tp.profile === 'HTS' ? tp.HTS_tournamentData(workbook) : {};
    if (Object.keys(tournament_data).length) {
      let rank = tournament_data.rang_turnira
        ? parseInt(tournament_data.rang_turnira.match(/\d+/))
        : undefined;
      tournament_rank = rank && rank.length ? rank[0] : undefined;
      tournament_category = tournament_data.draw
        ? tournament_data.draw.match(/\d+/)
        : undefined;
      tournament_category = tournament_category
        ? parseInt(tournament_category[0])
        : 20;
      tournament_category = staging.legacyCategory(tournament_category);
    }

    let processSheet = ({ /*sheet_names, */ sheet_name }) => {
      let draw_format;
      let sheet = workbook.Sheets[sheet_name];
      let player_data = tp.drawPlayers({ sheet });
      let players = player_data.players;
      let draw = tp.tournamentDraw({ sheet_name, sheet, player_data });
      console.log(
        "sheet name:",
        sheet_name,
        "matches:",
        draw.matches.length,
        draw.matches
      );
      let playerData = (name) =>
        players.filter((player) => player.full_name === name)[0];
      let preroundPlayerData = (name) =>
        player_data.preround.players.filter(
          (player) => player.full_name === name
        )[0];
      let draw_positions = players
        .map((m) => m.drawPosition)
        .filter((item, i, s) => s.lastIndexOf(item) === i).length;
      // let round_robin = players.length ? players.map(p=>p.roundRobinResult !== undefined).reduce((a, b) => a || b) : false;

      let consolation = sheet_name.indexOf("UT") >= 0;
      let qualification = sheet_name.indexOf("Q") >= 0;
      if (qualification) console.log("qualification!");

      if (tp.profile === "TP") {
        let number = /\d+/;
        let type = tp.value(sheet["A2"]);
        tournament_category = number.test(type)
          ? number.exec(type)[0]
          : undefined;
      }

      let processMatch = (match) => {
        let format = match.winner_names.length === 2 ? "doubles" : "singles";
        if (format === "doubles" && !match.loser_names.length) {
          console.log("Type 2 PARSING ERROR!", match);
          parsing_errors = true;
          return;
        }
        if (!draw_format) {
          draw_format = format;
        } else if (draw_format !== format) {
          console.log("Match Format Error");
        }
        let players = [];
        match.winner_names.forEach((winner) => {
          if (winner)
            players.push(playerData(winner) || preroundPlayerData(winner));
        });
        match.loser_names.forEach((loser) => {
          if (loser)
            players.push(playerData(loser) || preroundPlayerData(loser));
        });

        let ids = players.map((player) =>
          stringFx.nameHash(player.first_name + player.last_name)
        );

        let row = {};
        let tournament = {};
        tournament.category =
          tournament_category && staging.legacyCategory(tournament_category);
        if (tournament.category && categories.indexOf(tournament.category) < 0)
          categories.push(tournament.category);

        let tournament_cell = workbook.Sheets[workbook.SheetNames[0]].A1;
        // let tournament_name = workbook.Sheets[workbook.SheetNames[0]].A1.v;
        let tournament_name = (tournament_cell && tournament.v) || "";
        let tournament_code = tournament_name.split(" ").join("");
        tournament.name = tournament_name;
        tournament.code = tournament_code;

        players.forEach((player) => {
          if (player.drawPosition > draw_positions) {
            row.preround = true;
            player.drawPosition = "pre";
          }
        });

        Object.assign(row, {
          ids,
          players,
          format,
          consolation,
          qualification,
          tournament,
          draw_positions,
          round_name: match.round_name,
          score: match.result,
          gender: match.gender,
          teams:
            format === "singles"
              ? [[0], [1]]
              : [
                  [0, 1],
                  [2, 3],
                ],
          winner: 0,
        });
        let muid = [
          tuid,
          ...row.players.map(
            (player) =>
              player.last_name +
              (player.club || player.ioc || "") +
              player.drawPosition
          ),
          row.round,
        ].join("");
        row.muid = muid.split(" ").join("");
        if (players.length) rows.push(row);
      };

      draw.matches.forEach((match) => processMatch(match));
      if (draw.preround) draw.preround.forEach((match) => processMatch(match));

      ranks[draw_format] = draw.rank || tournament_rank;
    };

    let sheet_names = workbook.SheetNames.filter((sheet_name) => {
      /*
         if (tp.profile === 'HTS') {
            if (sheet_name.toLowerCase().indexOf('raspored') >= 0) return false;
            return sheet_name.match(/\d+/) || sheet_name.match(/_M/) || sheet_name.match(/_Z/);
         }
         */
      return sheet_name;
    });

    sheet_names.forEach((sheet_name) => {
      if (tp.verbose) console.log("processing draw:", sheet_name);
      processSheet({ sheet_names, sheet_name });
    });

    if (parsing_errors) alert("Parsing Error: Check Points");
    return { ranks, rows, categories };
  };

  tp.setWorkbookProfile = ({ workbook }) => {
    let sheet_names = workbook.SheetNames;

    Object.keys(tp.profiles).forEach((profile) => {
      let identification = tp.profiles[profile].identification;
      if (
        identification.includes &&
        includes(sheet_names, identification.includes)
      )
        tp.profile = profile;
      if (
        identification.sub_includes &&
        subInclude(sheet_names, identification.sub_includes)
      )
        tp.profile = profile;
    });
    // if (!tp.profile) tp.profile = 'HTS';
  };

  // if (typeof define === "function" && define.amd) define(tournamentParser); else if (typeof module === "object" && module.exports) module.exports = tournamentParser;
  return tp;
})();
