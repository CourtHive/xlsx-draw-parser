import React, { forwardRef, useState } from 'react';

import { Clear, Search, ViewColumn } from '@material-ui/icons';
import { Paper } from '@material-ui/core';

import MaterialTable from 'material-table';

function renderSide(rowData, attribute) {
    if (rowData[attribute]) {
        if (rowData[attribute].length === 1) {
            return rowData[attribute][0].full_name;
        } else if (rowData[attribute].length === 2) {
            return rowData[attribute].map(p => p.last_name).join('/');
        }
    } 
    return '';
}

function renderWinner(rowData) { return renderSide(rowData, 'winningSide'); }
function renderLoser(rowData) { return renderSide(rowData, 'losers'); }

const participantSearch = (value, rowData, attribute) => {
    let name = renderSide(rowData, attribute);
    if (!value) return;
    return name.toLowerCase().indexOf(value.toLowerCase()) >= 0;
}

const winnerSearch = (value, rowData) => participantSearch(value, rowData, 'winningSide');
const loserSearch = (value, rowData) => participantSearch(value, rowData, 'losers');

function renderFormat(rowData) {
    if (!rowData.matchType) return '';
    return rowData.matchType;
}
function formatSearch(value, rowData) {
    let format = renderFormat(rowData);
    return format.toLowerCase().indexOf(value.toLowerCase()) >= 0;
}

const columns = [
    { title: 'Event', field: 'event' },
    { title: 'Gender', field: 'gender' },
    { title: 'Format', render: renderFormat, customFilterAndSearch: formatSearch },
    { title: 'Winner', render: renderWinner, customFilterAndSearch: winnerSearch },
    { title: 'Loser', render: renderLoser, customFilterAndSearch: loserSearch },
    { title: 'Round #', field: 'roundNumber', hidden: true },
    { title: 'Round Name', field: 'roundName' },
    { title: 'Result', field: 'result' }
];
const options = {
    pageSize: 10,
    search: true,
    paging: false,
    sorting: true,
    actions: false,
    editable: false,
    showTitle: true,
    selection: false,
    padding: 'dense',
    columnsButton: true,
    maxBodyHeight: window.innerHeight,
    pageSizeOptions: [10, 20, 50],
    headerStyle: {fontWeight:'bold'}
}

const localization = {
    body: {
        emptyDataSourceMessage: 'No Data'
    },
    toolbar: {
        searchTooltip: 'Search',
        searchPlaceholder: 'Search...'
    },
    pagination: {
        labelRowsSelect: 'rows',
        labelDisplayedRows: '{from}-{to} of {count}',
        firstTooltip: 'First Page',
        previousTooltip: 'Previous Page',
        nextTooltip: 'Next Page',
        lastTooltip: 'Last Page'
    }
}

export function MatchUpsTable(props) {
    const { matchUps, title } = props;
    const defaultValues = { selectedRow: null };
    const [values, setValues] = useState(defaultValues);

    const rowStyle = rowData => ({
        backgroundColor: (values.selectedRow && values.selectedRow.tableData.id === rowData.tableData.id) ? '#EEE' : '#FFF'
    })

    const defaultOptions = {
        rowStyle,
        actionsColumnIndex: columns.length
    };

    const rowClick = (_, rowData, togglePanel) => {
        setValues({...values, selectedRow: rowData });
        if (options.detail) togglePanel();
    }

    const components = { Container: props => <Paper {...props} elevation={0}/> }
    
    return (
      <MaterialTable
        title={title}
        options={Object.assign(defaultOptions, options)}
        columns={columns}
        components={components}
        data={matchUps}        
        onRowClick={rowClick}
        localization={localization}
        icons={{
            Clear: forwardRef((props, ref) => <Clear {...props} ref={ref} color='action' />),
            Search: forwardRef((props, ref) => <Search {...props} ref={ref} color='action' />),
            ViewColumn: forwardRef((props, ref) => <ViewColumn {...props} ref={ref} color='action' />),
        }}
      />
    )
}
