import React from 'react';
import ReactJson from 'react-json-view';
import { useSelector } from 'react-redux'

import { Box, Container } from '@material-ui/core';
import { MatchUpsTable } from 'components/tables/matchUpsTable';

import { Welcome } from 'components/panels/welcome';

export function ResultsContent(props) {
  const { view } = props;
  const data = useSelector(state => state.xlsx.matchUps);
  let matchUps = JSON.parse(JSON.stringify(data));
  
  const tournamentRecord = useSelector(state => state.xlsx.tournamentRecord);
  
  return (
    
      <Container>
        {
          !matchUps.length
          ? <Welcome />
          : view === 'table'
          ? <MatchUpsTable matchUps={matchUps} />
          : <Box m={3}>
              <ReactJson
                collapsed={1}
                style={{fontSize: 18}}
                src={tournamentRecord}
                theme='summerfruit:inverted'
                displayDataTypes={false}
              />
            </Box>
        }
      </Container>
      
  )
}