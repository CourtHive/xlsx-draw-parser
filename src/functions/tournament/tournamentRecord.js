import { INDIVIDUAL, PAIR, QUALIFYING } from "types/todsConstants";

import { xlsxStore } from "stores/xlsxStore";
import { unique } from "functions/utilities";
import { addDev } from "config/setDev";
import { normalizeName } from "normalize-text";

export function createTournamentRecord({
  draws,
  tournamentData,
  allPlayers,
  allParticipants,
}) {
  const { tournamentId } = generateTournamentId({ tournamentData });
  const { tournamentName, providerId, startDate, endDate, city } =
    tournamentData;

  const tournamentAddresses = [{ city }];

  let tournamentRecord = {
    providerId,
    tournamentId,
    tournamentName,
    tournamentAddresses,
    startDate,
    endDate,
  };

  const { events } = getEvents({ draws });
  Object.assign(tournamentRecord, { events });

  const { participants } = getParticipants({ allPlayers, allParticipants });
  Object.assign(tournamentRecord, { participants });

  const matchUps = draws.map((draw) => draw.matchUps).flat();

  addDev({ matchUps, tournamentRecord });

  xlsxStore.dispatch({
    type: "set tournament record",
    payload: { tournamentRecord, matchUps, originalDraws: draws },
  });
}

function getParticipants({ allPlayers, allParticipants }) {
  let participants = Object.keys(allParticipants).map((participantId) => {
    const participantIds = allParticipants[participantId].participantIds;
    if (participantIds.length === 2) {
      return pairParticipant(participantId);
    } else {
      return individualParticipant(participantId);
    }
  });

  return { participants };

  function pairParticipant(participantId) {
    const pair = allParticipants[participantId];
    const participantIds = pair.participantIds;
    const players = participantIds.map(
      (participantId) => allPlayers[participantId]
    );
    const participantName = players.map((player) => player.last_name).join("/");

    const individualParticipants = participantIds.map((participantId) => {
      const participant = { participantId };
      return participant;
    });
    const participant = {
      participantRole: "COMPETITOR",
      individualParticipants,
      participantType: PAIR,
      participantName,
      participantId,
    };
    return participant;
  }

  function individualParticipant(participantId) {
    const player = allPlayers[participantId];
    if (!player) {
      console.log("no player", { participantId });
      return {};
    }
    const participant = {
      participantName: normalizeName(
        `${player.last_name}, ${player.first_name}`
      ),
      participantRole: "COMPETITOR",
      participantType: INDIVIDUAL,
      participantId,
      person: {
        personId: player.personId,
        gender: player.gender,
        standardFamilyName: player.last_name,
        standardGivenName: player.first_name,
      },
    };
    return participant;
  }
}

function getEvents({ draws }) {
  const eventTypes = unique(
    draws.map((draw) => `${draw.event}|${draw.drawFormat}`)
  );
  const events = eventTypes.reduce((events, type) => {
    const [event, format] = type.split("|");
    const eventDraws = draws.filter(
      (draw) => draw.event === event && draw.drawFormat === format
    );
    if (!eventDraws.length) return events;
    const drawId = eventDraws[0].drawId;
    const entries = getEventEntries({ eventDraws });
    const gender = eventDraws[0].gender;
    const eventCategory = eventDraws[0].event;
    const eventType = eventDraws[0].drawFormat;
    const eventName = [eventCategory, eventType].join(" ");
    const structures = eventDraws
      .map((draw) => draw.structure)
      .filter((structure) => structure.matchUps && structure.matchUps.length);
    const candidate = {
      gender,
      entries,
      eventName,
      eventType,
      eventId: `${drawId}-E`,
      draws: [
        {
          drawId: `${drawId}-D`,
          entryProfile: {},
          links: [],
          entries,
          structures,
        },
      ],
    };
    return events.concat(candidate);
  }, []);

  return { events };
}

function getEventEntries({ eventDraws }) {
  let entriesMap = {};
  eventDraws
    .map((draw) => {
      const entryStage = draw.structure.stage;
      return draw.entries.map((entry) => Object.assign(entry, { entryStage }));
    })
    .flat()
    .forEach((entry) => {
      const participantId = entry.participantId;
      if (!entriesMap[participantId] || entry.entryStage === QUALIFYING) {
        entriesMap[participantId] = entry;
      }
    });
  const entries = Object.keys(entriesMap).map((key) => entriesMap[key]);
  return entries;
}

function generateTournamentId({ tournamentData } = {}) {
  let tournamentId;
  const {
    tournamentName,
    startDate = "",
    categories = [],
    city = "",
  } = tournamentData;
  const categoryString = categories.join("");
  if (tournamentName) {
    const name = tournamentName.split(" ").join("_");
    tournamentId = [name, city, categoryString, startDate].join("_");
  }
  return { tournamentId };
}
