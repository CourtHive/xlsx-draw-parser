import React, { useState } from 'react';
import { useSelector } from 'react-redux'

import { LinearProgress } from '@material-ui/core';
import { AppBar, Fab, Toolbar } from '@material-ui/core/';
import { makeStyles, CssBaseline, Typography } from '@material-ui/core';
import { KeyboardArrowUp } from '@material-ui/icons';

import { ScrollTop } from 'components/buttons/scrollTop';
import { LoadButton } from 'components/buttons/loadButton';
import { AppToaster } from 'components/dialogs/AppToaster';
import { IdiomButton } from 'components/buttons/idiomButton';
import { ResultsContent } from 'components/panels/resultsContent';
import { DownloadButton } from 'components/buttons/downloadButton';
import { TournamentView } from 'components/buttons/tournamentView';

import { initialState } from 'config/InitialState';
import { setDev } from 'config/setDev';

import './App.css';

setDev();
initialState();

const useStyles = makeStyles((theme) => ({
  spacer: { flexGrow: 1 },
}));

export default function App(props) {
  const classes = useStyles();
  const [view, setView] = useState('table');
  
  const matchUps = useSelector(state => state.xlsx.matchUps);
  const hasData = matchUps && matchUps.length;
  
  const tournamentName = useSelector(state => state.xlsx.tournamentRecord.tournamentName);
  const loadingState = useSelector((state) => state.xlsx.loadingState);

  return (
    <>
      <AppToaster />
      <CssBaseline />
      <AppBar>
        <Toolbar>
          <TournamentView hasData={hasData} view={view} setView={setView} />
          <DownloadButton hasData={hasData} />
          <Typography variant='h6' className={classes.spacer} align='center'>
            {tournamentName || ''}
          </Typography>
          <IdiomButton />
          <LoadButton />
        </Toolbar>
      </AppBar>
      <Toolbar id="back-to-top-anchor" />
      { !loadingState ? '' : <LinearProgress color='secondary' /> }
      <ResultsContent view={view} />
      <ScrollTop {...props}>
        <Fab color="secondary" size="small" aria-label="scroll back to top">
          <KeyboardArrowUp />
        </Fab>
      </ScrollTop>
    </>
  );
}
