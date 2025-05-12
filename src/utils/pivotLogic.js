// utils/pivotLogic.js
import { format } from "date-fns";

// Date-related utility functions
export const isDateString = (value) => {
  if (!value || typeof value !== "string") return false;
  const date = new Date(value);
  return !isNaN(date);
};

export const isExcelDateNumber = (value) => {
  if (value === null || value === undefined) return false;
  const num = Number(value);
  return !isNaN(num) && num > 25000 && num < 50000;
};

export const excelDateToJSDate = (excelDate) => {
  const daysSince1900 = Number(excelDate);

  let adjustedDays = daysSince1900;
  if (daysSince1900 > 60) {
    adjustedDays -= 0; // Adjust for the non-existent Feb 29, 1900
  }

  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + adjustedDays);

  return date;
};

export const detectFieldTypes = (data) => {
  if (!data || data.length === 0) return {};

  const fieldTypes = {};
  const sampleRow = data[0];

  Object.keys(sampleRow).forEach((field) => {
    const samples = data
      .slice(0, 5)
      .map((row) => row[field])
      .filter((val) => val !== null && val !== undefined);

    if (samples.some((val) => isExcelDateNumber(val))) {
      fieldTypes[field] = "date";
    } else if (samples.some((val) => isDateString(val))) {
      fieldTypes[field] = "date";
    } else if (samples.every((val) => !isNaN(Number(val)))) {
      fieldTypes[field] = "number";
    } else {
      fieldTypes[field] = "string";
    }
  });

  return fieldTypes;
};

export const generateDateHierarchyFields = (dateFields) => {
  const hierarchyFields = [];

  dateFields.forEach((field) => {
    hierarchyFields.push(
      { label: `${field} (Year)`, value: `${field}|year` },
      { label: `${field} (Quarter)`, value: `${field}|quarter` },
      { label: `${field} (Month)`, value: `${field}|month` },
      { label: `${field} (Full Date)`, value: `${field}|date` }
    );
  });

  return hierarchyFields;
};

export const formatDateValue = (value) => {
  if (value === null || value === undefined) return null;

  let dateObj;

  if (isExcelDateNumber(value)) {
    dateObj = excelDateToJSDate(value);
  } else if (isDateString(value)) {
    dateObj = new Date(value);
  } else {
    return value; // Return original value if not a date
  }

  if (isNaN(dateObj.getTime())) return value; // Return original if conversion failed

  return format(dateObj, "MM/dd/yyyy");
};

export const getDatePartValue = (value, part) => {
  try {
    let dateObj;

    if (isExcelDateNumber(value)) {
      dateObj = excelDateToJSDate(value);
    } else if (typeof value === "string") {
      dateObj = new Date(value);
    } else {
      return null; // Not a date we can process
    }

    if (isNaN(dateObj.getTime())) return null;

    switch (part) {
      case "year":
        return dateObj.getFullYear().toString();
      case "quarter":
        return `Q${Math.floor(dateObj.getMonth() / 3) + 1}`;
      case "month":
        return format(dateObj, "MMM yyyy");
      case "date":
      default:
        return format(dateObj, "MM/dd/yyyy");
    }
  } catch (e) {
    console.error("Error processing date:", e);
    return null;
  }
};

// Core pivot table generation logic
export const generatePivotData = (
  data,
  rowFields,
  columnFields,
  valueFields,
  aggregateFunctions
) => {
  // Return early if no data
  if (!data || data.length === 0) {
    return { pivotData: [], columnHeaders: [] };
  }

  // Process date hierarchy fields
  const processedData = processDateFields(data, [
    ...rowFields,
    ...columnFields,
  ]);

  // Create map for row and column unique values
  const rowValues = getUniqueValues(processedData, rowFields);
  const columnValues = getUniqueValues(processedData, columnFields);

  // Generate column headers
  const columnHeaders = generateColumnHeaders(columnValues);

  // Generate pivot data rows
  const pivotData = generatePivotRows(
    processedData,
    rowValues,
    columnHeaders,
    rowFields,
    columnFields,
    valueFields,
    aggregateFunctions
  );

  // Calculate grand totals for rows
  calculateRowGrandTotals(
    pivotData,
    columnHeaders,
    valueFields,
    aggregateFunctions
  );

  // Calculate column grand totals
  const columnGrandTotals = calculateColumnGrandTotals(
    processedData,
    columnHeaders,
    rowFields,
    columnFields,
    valueFields,
    aggregateFunctions
  );

  return { pivotData, columnHeaders, columnGrandTotals };
};

// Process data to handle date hierarchy fields
export const processDateFields = (data, fields) => {
  if (!fields || fields.length === 0) return data;

  return data.map((row) => {
    const newRow = { ...row };

    fields.forEach((field) => {
      if (field.includes("|")) {
        const [baseField, datePart] = field.split("|");
        if (row[baseField] !== undefined) {
          newRow[field] = getDatePartValue(row[baseField], datePart);
        }
      }
    });

    return newRow;
  });
};

// Get unique combinations of values for the given fields
export const getUniqueValues = (data, fields) => {
  if (!fields || fields.length === 0) return [[]];

  const uniqueCombos = new Map();

  data.forEach((row) => {
    const values = fields.map((field) =>
      row[field] === undefined ? null : row[field]
    );
    const key = JSON.stringify(values);

    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, values);
    }
  });

  return Array.from(uniqueCombos.values());
};

// Generate column headers based on unique column values
export const generateColumnHeaders = (columnValues) => {
  if (
    !columnValues ||
    columnValues.length === 0 ||
    columnValues[0].length === 0
  ) {
    return [{ key: "total", values: ["Total"] }];
  }

  return columnValues.map((values) => ({
    key: JSON.stringify(values),
    values: values,
  }));
};

// Generate rows for the pivot table
export const generatePivotRows = (
  data,
  rowValues,
  columnHeaders,
  rowFields,
  columnFields,
  valueFields,
  aggregateFunctions
) => {
  const pivotRows = [];

  rowValues.forEach((rowValue) => {
    const rowData = {
      rowValues: rowValue,
      cells: {},
    };

    // Filter data matching this row
    let rowData_filtered = data;
    if (rowFields.length > 0) {
      rowData_filtered = data.filter((item) => {
        return rowFields.every((field, idx) => {
          const rowVal = rowValue[idx] === undefined ? null : rowValue[idx];
          const itemVal = item[field] === undefined ? null : item[field];
          return String(rowVal) === String(itemVal);
        });
      });
    }

    // Process each column header
    columnHeaders.forEach((column) => {
      let columnData_filtered = rowData_filtered;

      // Filter data matching this column (if not the "Total" column)
      if (column.key !== "total" && columnFields.length > 0) {
        columnData_filtered = rowData_filtered.filter((item) => {
          return columnFields.every((field, idx) => {
            const colVal =
              column.values[idx] === undefined ? null : column.values[idx];
            const itemVal = item[field] === undefined ? null : item[field];
            return String(colVal) === String(itemVal);
          });
        });
      }

      // Calculate aggregates for each value field and aggregate function
      valueFields.forEach((valueField) => {
        aggregateFunctions.forEach((aggFunc) => {
          const cellKey = `${column.key}|${valueField}|${aggFunc}`;
          rowData.cells[cellKey] = calculateAggregate(
            columnData_filtered,
            valueField,
            aggFunc
          );
        });
      });
    });

    pivotRows.push(rowData);
  });

  return pivotRows;
};

// Calculate aggregate value
export const calculateAggregate = (data, field, aggregateFunction) => {
  if (!data || data.length === 0) return null;

  const validValues = data
    .map((item) => item[field])
    .filter((val) => val !== null && val !== undefined && !isNaN(Number(val)));

  if (validValues.length === 0) return null;

  switch (aggregateFunction) {
    case "sum":
      return validValues.reduce((sum, val) => sum + Number(val), 0);
    case "avg":
      return (
        validValues.reduce((sum, val) => sum + Number(val), 0) /
        validValues.length
      );
    case "count":
      return validValues.length;
    case "min":
      return Math.min(...validValues.map((val) => Number(val)));
    case "max":
      return Math.max(...validValues.map((val) => Number(val)));
    default:
      return null;
  }
};

// Calculate row grand totals
export const calculateRowGrandTotals = (
  pivotData,
  columnHeaders,
  valueFields,
  aggregateFunctions
) => {
  const grandTotalKey = "grandTotal";

  // Add grand total cells to each row
  pivotData.forEach((row) => {
    valueFields.forEach((valueField) => {
      aggregateFunctions.forEach((aggFunc) => {
        // Skip for count aggregates which need special handling
        if (aggFunc === "count") return;

        const grandTotalCellKey = `${grandTotalKey}|${valueField}|${aggFunc}`;

        if (aggFunc === "avg") {
          // For average, we need to calculate the weighted average
          let totalSum = 0;
          let totalCount = 0;
          let hasValues = false;

          // Sum all values and count non-null entries
          columnHeaders.forEach((column) => {
            const cellKey = `${column.key}|${valueField}|${aggFunc}`;
            const countKey = `${column.key}|${valueField}|count`;
            const avgValue = row.cells[cellKey];
            // We need to estimate the count for this cell
            // If count is available, use it, otherwise assume 1
            const countValue = row.cells[countKey] || 1;

            if (avgValue !== null && avgValue !== undefined) {
              hasValues = true;
              // For weighted average, multiply avg by count
              totalSum += avgValue * countValue;
              totalCount += countValue;
            }
          });

          // Calculate the weighted average
          row.cells[grandTotalCellKey] = hasValues
            ? totalSum / totalCount
            : null;
        } else {
          // For other aggregates (sum, min, max), use the existing logic
          let grandTotal = null;

          // Sum all values across columns for this row, value field, and aggregate function
          columnHeaders.forEach((column) => {
            const cellKey = `${column.key}|${valueField}|${aggFunc}`;
            const cellValue = row.cells[cellKey];

            if (cellValue !== null && cellValue !== undefined) {
              grandTotal =
                grandTotal === null ? cellValue : grandTotal + cellValue;
            }
          });

          row.cells[grandTotalCellKey] = grandTotal;
        }
      });

      // Special handling for count aggregates
      if (aggregateFunctions.includes("count")) {
        const grandTotalCellKey = `${grandTotalKey}|${valueField}|count`;

        // For count, we take the sum of all count values
        const countSum = columnHeaders.reduce((sum, column) => {
          const cellKey = `${column.key}|${valueField}|count`;
          const cellValue = row.cells[cellKey];
          return cellValue !== null && cellValue !== undefined
            ? sum + cellValue
            : sum;
        }, 0);

        row.cells[grandTotalCellKey] = countSum > 0 ? countSum : null;
      }
    });
  });
};

// Calculate column grand totals
export const calculateColumnGrandTotals = (
  data,
  columnHeaders,
  rowFields,
  columnFields,
  valueFields,
  aggregateFunctions
) => {
  const grandTotals = {
    cells: {},
  };

  // Calculate grand totals for each column and value field/aggregate combination
  columnHeaders.forEach((column) => {
    let columnData_filtered = data;

    // Filter data matching this column (if not the "Total" column)
    if (column.key !== "total" && columnFields.length > 0) {
      columnData_filtered = data.filter((item) => {
        return columnFields.every((field, idx) => {
          const colVal =
            column.values[idx] === undefined ? null : column.values[idx];
          const itemVal = item[field] === undefined ? null : item[field];
          return String(colVal) === String(itemVal);
        });
      });
    }

    // Calculate aggregates for each value field and aggregate function
    valueFields.forEach((valueField) => {
      aggregateFunctions.forEach((aggFunc) => {
        const cellKey = `${column.key}|${valueField}|${aggFunc}`;
        grandTotals.cells[cellKey] = calculateAggregate(
          columnData_filtered,
          valueField,
          aggFunc
        );
      });
    });
  });

  // Calculate grand total of grand totals
  valueFields.forEach((valueField) => {
    aggregateFunctions.forEach((aggFunc) => {
      // Skip for count aggregates which need special handling
      if (aggFunc === "count") return;

      const grandTotalCellKey = `grandTotal|${valueField}|${aggFunc}`;

      if (aggFunc === "avg") {
        // For average, calculate the true average using all data
        // This ensures consistency with row grand totals
        const allData = data.filter(
          (item) => item[valueField] !== null && item[valueField] !== undefined
        );
        if (allData.length > 0) {
          const sum = allData.reduce(
            (total, item) => total + Number(item[valueField]),
            0
          );
          grandTotals.cells[grandTotalCellKey] = sum / allData.length;
        } else {
          grandTotals.cells[grandTotalCellKey] = null;
        }
      } else {
        // For other aggregates (sum, min, max), use the existing logic
        let grandTotal = null;

        // Sum all values across columns
        columnHeaders.forEach((column) => {
          const cellKey = `${column.key}|${valueField}|${aggFunc}`;
          const cellValue = grandTotals.cells[cellKey];

          if (cellValue !== null && cellValue !== undefined) {
            grandTotal =
              grandTotal === null ? cellValue : grandTotal + cellValue;
          }
        });

        grandTotals.cells[grandTotalCellKey] = grandTotal;
      }
    });

    // Special handling for count aggregates
    if (aggregateFunctions.includes("count")) {
      const grandTotalCellKey = `grandTotal|${valueField}|count`;

      // For count, we take the sum of all count values
      const countSum = columnHeaders.reduce((sum, column) => {
        const cellKey = `${column.key}|${valueField}|count`;
        const cellValue = grandTotals.cells[cellKey];
        return cellValue !== null && cellValue !== undefined
          ? sum + cellValue
          : sum;
      }, 0);

      grandTotals.cells[grandTotalCellKey] = countSum > 0 ? countSum : null;
    }
  });

  return grandTotals;
};

// Format cell values based on the aggregate function
export const formatCellValue = (value, aggregateFunc) => {
  if (value === null || value === undefined) return "-";

  if (typeof value === "number") {
    if (aggregateFunc === "count") {
      return Math.round(value).toLocaleString();
    } else if (aggregateFunc === "avg") {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }

  return value;
};
