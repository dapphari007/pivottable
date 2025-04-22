import { format } from "date-fns";

// Date utility functions
const isExcelDateValue = (value) => {
  // Check if value is a number that could be an Excel date (generally between 0 and 50000)
  return typeof value === 'number' && value > 30000 && value < 50000;
};

const excelDateToJSDate = (excelDate) => {
  // Excel dates start from 1900-01-01
  return new Date((excelDate - 25569) * 86400 * 1000);
};

const isDateString = (value) => {
  if (!value || typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

// Field type detection
export const detectFieldTypes = (data) => {
  if (!data || data.length === 0) return {};
  
  const fieldTypes = {};
  const dateColumnPatterns = ['date', 'created', 'modified', 'timestamp', 'time'];
  const sampleRow = data[0];
  
  Object.keys(sampleRow).forEach(field => {
    // Check multiple rows for more accurate type detection
    const samples = data.slice(0, 10).map(row => row[field]).filter(val => val !== null && val !== undefined);
    
    // Check if field name suggests it's a date field
    const fieldNameSuggestsDate = dateColumnPatterns.some(pattern => 
      field.toLowerCase().includes(pattern)
    );
    
    // Check if values look like Excel dates
    const hasExcelDateValues = samples.some(val => isExcelDateValue(val));
    
    if (fieldNameSuggestsDate || hasExcelDateValues || samples.some(val => isDateString(val))) {
      fieldTypes[field] = 'date';
    } else if (samples.every(val => !isNaN(Number(val)))) {
      fieldTypes[field] = 'number';
    } else {
      fieldTypes[field] = 'string';
    }
  });
  
  return fieldTypes;
};

// Generate date hierarchy fields for date columns
export const generateDateHierarchyFields = (dateFields) => {
  const hierarchyFields = [];
  
  dateFields.forEach(field => {
    hierarchyFields.push(
      { label: `${field} (Year)`, value: `${field}|year` },
      { label: `${field} (Quarter)`, value: `${field}|quarter` },
      { label: `${field} (Month)`, value: `${field}|month` },
      { label: `${field} (Date)`, value: `${field}|date` }
    );
  });
  
  return hierarchyFields;
};

// Extract date part from a date value
export const getDatePartValue = (dateValue, part) => {
  try {
    let date;
    
    // Handle Excel date numbers
    if (isExcelDateValue(dateValue)) {
      date = excelDateToJSDate(dateValue);
    } 
    // Handle date strings
    else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } 
    // Handle Date objects
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    else {
      return null;
    }
    
    if (isNaN(date.getTime())) return null;
    
    switch (part) {
      case 'year':
        return date.getFullYear().toString();
      case 'quarter':
        return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      case 'month':
        return format(date, 'MMM yyyy');
      case 'date':
      default:
        return format(date, 'MM/dd/yyyy');
    }
  } catch (e) {
    return null;
  }
};

// Format cell values for display
export const formatCellValue = (value, aggregateFunc, isDateField = false) => {
  if (value === null || value === undefined) return "-";
  
  // Handle date formatting for Excel-style dates
  if (isDateField && isExcelDateValue(value)) {
    const date = excelDateToJSDate(value);
    return format(date, 'MM/dd/yyyy');
  }
  
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
  
  return value.toString();
};

// Process data to handle date hierarchy fields
export function processDateFields(data, fields, fieldTypes) {
  if (!fields || fields.length === 0) return data;
  
  return data.map(row => {
    const newRow = { ...row };
    
    fields.forEach(field => {
      if (field.includes('|')) {
        const [baseField, datePart] = field.split('|');
        if (row[baseField] !== undefined) {
          newRow[field] = getDatePartValue(row[baseField], datePart);
        }
      } else if (fieldTypes[field] === 'date' && isExcelDateValue(row[field])) {
        // Convert Excel dates to standard format for base fields too
        newRow[`${field}_formatted`] = getDatePartValue(row[field], 'date');
      }
    });
    
    return newRow;
  });
}

// Get unique combinations of values for the given fields
export function getUniqueValues(data, fields) {
  if (!fields || fields.length === 0) return [[]];
  
  const uniqueCombos = new Map();
  
  data.forEach(row => {
    const values = fields.map(field => row[field] === undefined ? null : row[field]);
    const key = JSON.stringify(values);
    
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, values);
    }
  });
  
  return Array.from(uniqueCombos.values());
}

// Generate column headers based on unique column values
export function generateColumnHeaders(columnValues) {
  if (!columnValues || columnValues.length === 0 || columnValues[0].length === 0) {
    return [{ key: "total", values: ["Total"] }];
  }
  
  return columnValues.map(values => ({
    key: JSON.stringify(values),
    values: values
  }));
}

// Calculate aggregate value
export function calculateAggregate(data, field, aggregateFunction) {
  if (!data || data.length === 0) return null;
  
  const validValues = data
    .map(item => item[field])
    .filter(val => val !== null && val !== undefined && !isNaN(Number(val)));
  
  if (validValues.length === 0) return null;
  
  switch (aggregateFunction) {
    case 'sum':
      return validValues.reduce((sum, val) => sum + Number(val), 0);
    case 'avg':
      return validValues.reduce((sum, val) => sum + Number(val), 0) / validValues.length;
    case 'count':
      return validValues.length;
    case 'min':
      return Math.min(...validValues.map(val => Number(val)));
    case 'max':
      return Math.max(...validValues.map(val => Number(val)));
    default:
      return null;
  }
}

// Generate pivot data 
export const generatePivotData = (data, rowFields, columnFields, valueFields, aggregateFunctions, fieldTypes) => {
  // Return early if no data
  if (!data || data.length === 0) {
    return { pivotData: [], columnHeaders: [] };
  }

  // Process date hierarchy fields
  const allFields = [...rowFields, ...columnFields];
  const processedData = processDateFields(data, allFields, fieldTypes);
  
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
  calculateRowGrandTotals(pivotData, columnHeaders, valueFields, aggregateFunctions);
  
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

// Generate rows for the pivot table
function generatePivotRows(data, rowValues, columnHeaders, rowFields, columnFields, valueFields, aggregateFunctions) {
  const pivotRows = [];
  
  rowValues.forEach(rowValue => {
    const rowData = {
      rowValues: rowValue,
      cells: {}
    };
    
    // Filter data matching this row
    let rowData_filtered = data;
    if (rowFields.length > 0) {
      rowData_filtered = data.filter(item => {
        return rowFields.every((field, idx) => {
          const rowVal = rowValue[idx] === undefined ? null : rowValue[idx];
          const itemVal = item[field] === undefined ? null : item[field];
          return String(rowVal) === String(itemVal);
        });
      });
    }
    
    // Process each column header
    columnHeaders.forEach(column => {
      let columnData_filtered = rowData_filtered;
      
      // Filter data matching this column (if not the "Total" column)
      if (column.key !== "total" && columnFields.length > 0) {
        columnData_filtered = rowData_filtered.filter(item => {
          return columnFields.every((field, idx) => {
            const colVal = column.values[idx] === undefined ? null : column.values[idx];
            const itemVal = item[field] === undefined ? null : item[field];
            return String(colVal) === String(itemVal);
          });
        });
      }
      
      // Calculate aggregates for each value field and aggregate function
      valueFields.forEach(valueField => {
        aggregateFunctions.forEach(aggFunc => {
          const cellKey = `${column.key}|${valueField}|${aggFunc}`;
          rowData.cells[cellKey] = calculateAggregate(columnData_filtered, valueField, aggFunc);
        });
      });
    });
    
    pivotRows.push(rowData);
  });
  
  return pivotRows;
}

// Calculate row grand totals
export function calculateRowGrandTotals(pivotData, columnHeaders, valueFields, aggregateFunctions) {
  const grandTotalKey = "grandTotal";
  
  // Add grand total cells to each row
  pivotData.forEach(row => {
    valueFields.forEach(valueField => {
      aggregateFunctions.forEach(aggFunc => {
        // Skip for count aggregates which need special handling
        if (aggFunc === 'count') return;
        
        const grandTotalCellKey = `${grandTotalKey}|${valueField}|${aggFunc}`;
        let grandTotal = null;
        
        // Sum all values across columns for this row, value field, and aggregate function
        columnHeaders.forEach(column => {
          const cellKey = `${column.key}|${valueField}|${aggFunc}`;
          const cellValue = row.cells[cellKey];
          
          if (cellValue !== null && cellValue !== undefined) {
            grandTotal = (grandTotal === null) ? cellValue : grandTotal + cellValue;
          }
        });
        
        row.cells[grandTotalCellKey] = grandTotal;
      });
      
      // Special handling for count aggregates
      if (aggregateFunctions.includes('count')) {
        const grandTotalCellKey = `${grandTotalKey}|${valueField}|count`;
        
        // For count, we take the sum of all count values
        const countSum = columnHeaders.reduce((sum, column) => {
          const cellKey = `${column.key}|${valueField}|count`;
          const cellValue = row.cells[cellKey];
          return cellValue !== null && cellValue !== undefined ? sum + cellValue : sum;
        }, 0);
        
        row.cells[grandTotalCellKey] = countSum > 0 ? countSum : null;
      }
    });
  });
}

// Calculate column grand totals
export function calculateColumnGrandTotals(data, columnHeaders, rowFields, columnFields, valueFields, aggregateFunctions) {
  const grandTotals = {
    cells: {}
  };
  
  // Calculate grand totals for each column and value field/aggregate combination
  columnHeaders.forEach(column => {
    let columnData_filtered = data;
    
    // Filter data matching this column (if not the "Total" column)
    if (column.key !== "total" && columnFields.length > 0) {
      columnData_filtered = data.filter(item => {
        return columnFields.every((field, idx) => {
          const colVal = column.values[idx] === undefined ? null : column.values[idx];
          const itemVal = item[field] === undefined ? null : item[field];
          return String(colVal) === String(itemVal);
        });
      });
    }
    
    // Calculate aggregates for each value field and aggregate function
    valueFields.forEach(valueField => {
      aggregateFunctions.forEach(aggFunc => {
        const cellKey = `${column.key}|${valueField}|${aggFunc}`;
        grandTotals.cells[cellKey] = calculateAggregate(columnData_filtered, valueField, aggFunc);
      });
    });
  });
  
  // Calculate grand total of grand totals
  valueFields.forEach(valueField => {
    aggregateFunctions.forEach(aggFunc => {
      // Skip for count aggregates which need special handling
      if (aggFunc === 'count') return;
      
      const grandTotalCellKey = `grandTotal|${valueField}|${aggFunc}`;
      let grandTotal = null;
      
      // Sum all values across columns
      columnHeaders.forEach(column => {
        const cellKey = `${column.key}|${valueField}|${aggFunc}`;
        const cellValue = grandTotals.cells[cellKey];
        
        if (cellValue !== null && cellValue !== undefined) {
          grandTotal = (grandTotal === null) ? cellValue : grandTotal + cellValue;
        }
      });
      
      grandTotals.cells[grandTotalCellKey] = grandTotal;
    });
    
    // Special handling for count aggregates
    if (aggregateFunctions.includes('count')) {
      const grandTotalCellKey = `grandTotal|${valueField}|count`;
      
      // For count, we take the sum of all count values
      const countSum = columnHeaders.reduce((sum, column) => {
        const cellKey = `${column.key}|${valueField}|count`;
        const cellValue = grandTotals.cells[cellKey];
        return cellValue !== null && cellValue !== undefined ? sum + cellValue : sum;
      }, 0);
      
      grandTotals.cells[grandTotalCellKey] = countSum > 0 ? countSum : null;
    }
  });
  
  return grandTotals;
}