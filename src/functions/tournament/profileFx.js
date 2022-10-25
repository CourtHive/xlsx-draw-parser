import {
  findRow,
  getRow,
  getCol,
  findValueRefs,
} from "functions/dataExtraction/sheetAccess.js";

export function findRowDefinition({ rowDefinitions, rowIds, type }) {
  return rowDefinitions.reduce((headerDefinition, currentDefinition) => {
    if (currentDefinition.type !== type) return headerDefinition;
    if (!rowIds.includes(currentDefinition.id)) return headerDefinition;
    return currentDefinition;
  }, undefined);
}

export function identifySheet({ sheet, profile }) {
  const sheetDefinitions = profile.sheetDefinitions;
  const rowDefinitions = profile.rowDefinitions;
  const rowIds = rowDefinitions
    .reduce((rowIds, rowDefinition) => {
      const row = findRow({ sheet, rowDefinition });
      return row ? rowIds.concat(rowDefinition.id) : rowIds;
    }, [])
    .filter((f) => f);
  const identifiedDefinition = sheetDefinitions.reduce(
    (sheetDefinition, currentDefinition) => {
      const exactMatch = currentDefinition.rowIds.reduce(
        (result, rowId) => rowIds.includes(rowId) && result,
        true
      );
      return exactMatch ? currentDefinition : sheetDefinition;
    },
    undefined
  );
  return identifiedDefinition;
}

// function confirms that header columns are in expected position
// and adjusts when possible...
export function getHeaderColumns({ sheet, profile, headerRow }) {
  const columnsMap = Object.assign({}, profile.columnsMap);
  if (profile.headerColumns) {
    profile.headerColumns.forEach((obj) => {
      const searchText = obj.header;
      const ref = findValueRefs(searchText, sheet).reduce(
        (p, c) => (getRow(c) === parseInt(headerRow) ? c : p),
        undefined
      );
      const col = ref && getCol(ref);
      if (col) columnsMap[obj.attr] = col;
    });
  }
  return columnsMap;
}
