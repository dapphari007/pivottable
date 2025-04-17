export const generatePivotData = (data, rowFields, columnFields, valueFields, aggregateFunctions) => {
  // Return early if no data
  if (!data || data.length === 0) {
    return { pivotData: [], columnHeaders: [] };
  }

  // Create map for row and column unique values
  const rowValues = getUniqueValues(data, rowFields);
  const columnValues = getUniqueValues(data, columnFields);
  
  // Generate column headers
  const columnHeaders = generateColumnHeaders(columnValues);
  
  // Generate pivot data rows
  const pivotData = generatePivotRows(data, rowValues, columnHeaders, rowFields, columnFields, valueFields, aggregateFunctions);
  
  return { pivotData, columnHeaders };
};

// Get unique combinations of values for the given fields
function getUniqueValues(data, fields) {
  if (!fields || fields.length === 0) return [[]];
  
  const uniqueCombos = new Map();
  
  data.forEach(row => {
    const values = fields.map(field => row[field]);
    const key = JSON.stringify(values);
    
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, values);
    }
  });
  
  return Array.from(uniqueCombos.values());
}

// Generate column headers based on unique column values
function generateColumnHeaders(columnValues) {
  if (!columnValues || columnValues.length === 0 || columnValues[0].length === 0) {
    return [{ key: "total", values: ["Total"] }];
  }
  
  return columnValues.map(values => ({
    key: JSON.stringify(values),
    values: values
  }));
}

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
        return rowFields.every((field, idx) => item[field] === rowValue[idx]);
      });
    }
    
    // Process each column header
    columnHeaders.forEach(column => {
      let columnData_filtered = rowData_filtered;
      
      // Filter data matching this column (if not the "Total" column)
      if (column.key !== "total" && columnFields.length > 0) {
        columnData_filtered = rowData_filtered.filter(item => {
          return columnFields.every((field, idx) => item[field] === column.values[idx]);
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

// Calculate aggregate value
function calculateAggregate(data, field, aggregateFunction) {
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