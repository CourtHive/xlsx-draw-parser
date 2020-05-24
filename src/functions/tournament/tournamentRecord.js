import { xlsxStore } from 'stores/xlsxStore';
import { unique } from 'functions/utilities';
import { INDIVIDUAL, PAIR, QUALIFYING } from 'types/todsConstants';

export function createTournamentRecord({draws, tournamentData, allPlayers, allParticipants }) {

  const { tournamentId } = generateTournamentId({tournamentData});
  const { tournamentName, providerId, startDate, endDate, city } = tournamentData;

  const tournamentAddresses = [ { city } ];
  
  let tournamentRecord = {
    providerId,
    tournamentId,
    tournamentName,
    tournamentAddresses,
    startDate,
    endDate
  };
  
  const { events } = getEvents({draws});
  Object.assign(tournamentRecord, { events });

  const { participants } = getParticipants({allPlayers, allParticipants});
  Object.assign(tournamentRecord, { participants });
  
  const matchUps = draws.map(draw => draw.matchUps).flat();
  
  xlsxStore.dispatch({
    type: 'set tournament record',
    payload: { tournamentRecord, matchUps, originalDraws: draws }
  });
}

function getParticipants({allPlayers, allParticipants}) {
  let participants = Object.keys(allParticipants).map(participantId => {
    const participantIds = allParticipants[participantId].participantIds;
    if (participantIds.length === 2) {
      return pairParticipant(participantId);   
    } else {
      return individualParticipant(participantId);
    }
  })
  
  return { participants };
 
  function pairParticipant(participantId) {
    const pair = allParticipants[participantId];
    const participantIds = pair.participantIds;
    const players = participantIds.map(participantId => allPlayers[participantId]);
    const name = players.map(player => player.last_name).join('/');
    const participant = {
      name,
      participantId,
      participantType: PAIR,
      participantIds 
    };
    return participant;
  }
  
  function individualParticipant(participantId) {
    const player = allPlayers[participantId];
    if (!player) {
      console.log('no player', {participantId});
      return {};
    }
    const participant = {
      participantId,
      participantType: INDIVIDUAL,
      name: player.last_name,
      preferredGivenName: player.first_name,
      person: {
        personId: player.personId,
        gender: player.gender
      }
    }
    return participant;
  }
}

function getEvents({draws}) {
  const eventTypes = unique(draws.map(draw => `${draw.event}|${draw.drawFormat}`));
  const events = eventTypes.reduce((events, type) => {
    const [event, format] = type.split('|');
    const eventDraws = draws
      .filter(draw => draw.event === event && draw.drawFormat === format)
    const drawId = eventDraws[0].drawId;
    const entries = getEventEntries({eventDraws});
    const gender = eventDraws[0].gender;
    const eventCategory = eventDraws[0].event;
    const eventType = eventDraws[0].drawFormat;
    const eventName = [eventCategory, eventType].join(' ');
    const structures = eventDraws.map(draw => draw.structure);
    const candidate = {
      gender,
      eventName,
      eventType,
      eventId: `${drawId}-E`,
      draws: [
        {
          drawId: `${drawId}-D`,
          entries,
          structures
        }
      ]
    };
    return events.concat(candidate);
  }, []);
 
  return { events };
}

function getEventEntries({eventDraws}) {
  let entriesMap = {};
  eventDraws.map(draw => {
    const entryStage = draw.structure.stage;
    const participantIds = draw.entries.map(entry => entry.participantId);
    return participantIds.map(participantId => ({ participantId, entryStage }));
  }).flat().forEach(entry => {
    const participantId = entry.participantId;
    if (!entriesMap[participantId] || entry.entryStage === QUALIFYING) {
      entriesMap[participantId] = entry;
    }
  });
  const entries = Object.keys(entriesMap).map(key => entriesMap[key]);
  return entries;
}

function generateTournamentId({tournamentData}={}) {
  let tournamentId;
  const { tournamentName, startDate='', categories=[], city='' } = tournamentData;
  const categoryString = categories.join('');
  if (tournamentName) {
    const name = tournamentName.split(' ').join('_');
    tournamentId = [name, city, categoryString, startDate].join('_');
  }
  return { tournamentId };
}
