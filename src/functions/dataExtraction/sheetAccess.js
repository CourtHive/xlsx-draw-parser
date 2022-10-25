import { normalizeDiacritics, normalizeWhiteSpaces } from "normalize-text";
import { unique, instanceCount } from "functions/utilities";

export function numberValue(sheet, reference) {
  return !isNaN(parseInt(getCellValue(sheet[reference])))
    ? parseInt(getCellValue(sheet[reference]))
    : "";
}
export function cellsContaining({ sheet, term }) {
  let references = Object.keys(sheet);
  return references.filter(
    (ref) =>
      (sheet[ref].v + "")
        .toLowerCase()
        .indexOf(normalizeDiacritics(term).toLowerCase()) >= 0
  );
}

export function onlyNameChars(value) {
  // eslint-disable-next-line no-useless-escape
  return normalizeWhiteSpaces(value.replace(/[^A-Za-z\-]/g, " "));
}

export function extractNameField(cellRef) {
  const value = getCellValue(cellRef);
  return onlyNameChars(value);
}

export function getCellValue(cell) {
  let val = cell ? cell.v + "" : "";
  val = typeof val === "string" ? val.trim() : val;
  val = normalizeWhiteSpaces(val);
  val = val.indexOf(",,") >= 0 ? val.replace(",,", ",") : val;
  val =
    val.indexOf(",") >= 0
      ? val
          .split(",")
          .map((v) => v.trim())
          .join(", ")
      : val;
  return normalizeDiacritics(val);
}

export function getRow(reference) {
  const numericPart = reference && /\d+/.exec(reference);
  return numericPart ? parseInt(numericPart[0]) : undefined;
}

export function getCol(reference) {
  return reference ? reference[0] : undefined;
}

export function findValueRefs(searchText, sheet, options) {
  const lowercaseSearchText = (searchText || "").toLowerCase();
  return Object.keys(sheet).filter(
    (ref) =>
      transformValue(getCellValue(sheet[ref])) ===
      normalizeDiacritics(lowercaseSearchText)
  );

  function transformValue(value) {
    value = value.toLowerCase();
    value = normalizeDiacritics(value);
    if (options) {
      if (options.remove && Array.isArray(options.remove)) {
        options.remove.forEach((replace) => {
          const re = new RegExp(replace, "g");
          value = value.replace(re, "");
        });
      }
    }
    return value;
  }
}

export function getTargetValue({
  searchText,
  sheet,
  rowOffset = 0,
  columnOffset = 0,
  options,
}) {
  const nameRefs = findValueRefs(searchText, sheet, options);
  if (!Array.isArray(nameRefs) || nameRefs.length < 1) return "";
  const row = getRow(nameRefs);
  const targetRow = row + rowOffset;
  const column = getCol(nameRefs[0]);
  const targetColumn = String.fromCharCode(
    ((column && column.charCodeAt()) || 0) + columnOffset
  );
  const targetRef = `${targetColumn}${targetRow}`;
  const value = getCellValue(sheet[targetRef]);
  return value;
}

export function findRow({
  firstTargetRow,
  allTargetRows,
  rowDefinition,
  sheet,
}) {
  const rowElements = rowDefinition && rowDefinition.elements;
  if (!rowElements) return;
  const options = { lowerCase: true, normalize: true, remove: [":"] };
  const elementRows = [].concat(
    ...rowElements
      .map((element) => (options.lowerCase ? element.toLowerCase() : element))
      .map((element) =>
        options.normalize ? normalizeDiacritics(element) : element
      )
      .map((element) => {
        const valueRefs = findValueRefs(element, sheet, options);
        // remove duplicate instances on the same row
        return unique(valueRefs.map(getRow));
      })
      .filter((f) => f.length)
  );
  const valueCounts = instanceCount(elementRows);
  const elementInstances = Math.max(0, ...Object.values(valueCounts));
  if (elementInstances >= rowDefinition.minimumElements) {
    const targetRows = Object.keys(valueCounts).reduce(
      (p, c) => (valueCounts[c] === elementInstances ? p.concat(+c) : p),
      []
    );
    if (allTargetRows) {
      return targetRows;
    } else if (firstTargetRow) {
      return Math.min(...targetRows);
    } else {
      return Math.max(...targetRows);
    }
  }
}
