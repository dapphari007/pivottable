import React, { useState, useEffect } from "react";
import Select from "react-select";
import { format } from "date-fns";

// Utility functions for pivot table
const isDateString = (value) => {
  if (!value || typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date);
};

// Function to check if a value is an Excel date number
const isExcelDateNumber = (value) => {
  // Check if it's a number or a string that can be parsed to a number
  if (value === null || value === undefined) return false;
  const num = Number(value);
  // Excel date numbers are typically large numbers with decimal points
  return !isNaN(num) && num > 25000 && num < 50000;
};

// Function to convert Excel date number to JavaScript Date
const excelDateToJSDate = (excelDate) => {
  // Excel dates start at January 0, 1900
  // JavaScript dates use milliseconds since Jan 1, 1970
  // First, convert to days since Jan 1, 1900
  const daysSince1900 = Number(excelDate);
  
  // Excel has a leap year bug: it includes Feb 29, 1900 which didn't exist
  // So we need to adjust for dates after February 28, 1900
  let adjustedDays = daysSince1900;
  if (daysSince1900 > 60) {
    adjustedDays -= 0; // Adjust for the non-existent Feb 29, 1900
  }
  
  // Create a date for Dec 31, 1899, then add the adjusted days
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + adjustedDays);
  
  return date;
};

const detectFieldTypes = (data) => {
  if (!data || data.length === 0) return {};
  
  const fieldTypes = {};
  const sampleRow = data[0];
  
  Object.keys(sampleRow).forEach(field => {
    // Check multiple rows for more accurate type detection
    const samples = data.slice(0, 5).map(row => row[field]).filter(val => val !== null && val !== undefined);
    
    if (samples.some(val => isExcelDateNumber(val))) {
      fieldTypes[field] = 'date';
    } else if (samples.some(val => isDateString(val))) {
      fieldTypes[field] = 'date';
    } else if (samples.every(val => !isNaN(Number(val)))) {
      fieldTypes[field] = 'number';
    } else {
      fieldTypes[field] = 'string';
    }
  });
  
  return fieldTypes;
};

const generateDateHierarchyFields = (dateFields) => {
  const hierarchyFields = [];
  
  dateFields.forEach(field => {
    hierarchyFields.push(
      { label: `${field} (Year)`, value: `${field}|year` },
      { label: `${field} (Quarter)`, value: `${field}|quarter` },
      { label: `${field} (Month)`, value: `${field}|month` },
      { label: `${field} (Full Date)`, value: `${field}|date` }
    );
  });
  
  return hierarchyFields;
};

const formatDateValue = (value) => {
  if (value === null || value === undefined) return null;
  
  let dateObj;
  
  // Check if value is an Excel date number
  if (isExcelDateNumber(value)) {
    dateObj = excelDateToJSDate(value);
  } else if (isDateString(value)) {
    dateObj = new Date(value);
  } else {
    return value; // Return original value if not a date
  }
  
  if (isNaN(dateObj.getTime())) return value;  // Return original if conversion failed
  
  return format(dateObj, 'MM/dd/yyyy');
};

const getDatePartValue = (value, part) => {
  try {
    let dateObj;
    
    // Check if value is an Excel date number
    if (isExcelDateNumber(value)) {
      dateObj = excelDateToJSDate(value);
    } else if (typeof value === 'string') {
      dateObj = new Date(value);
    } else {
      return null; // Not a date we can process
    }
    
    if (isNaN(dateObj.getTime())) return null;
    
    switch (part) {
      case 'year':
        return dateObj.getFullYear().toString();
      case 'quarter':
        return `Q${Math.floor(dateObj.getMonth() / 3) + 1}`;
      case 'month':
        return format(dateObj, 'MMM yyyy');
      case 'date':
      default:
        return format(dateObj, 'MM/dd/yyyy');
    }
  } catch (e) {
    console.error("Error processing date:", e);
    return null;
  }
};

const generatePivotData = (data, rowFields, columnFields, valueFields, aggregateFunctions) => {
  // Return early if no data
  if (!data || data.length === 0) {
    return { pivotData: [], columnHeaders: [] };
  }

  // Process date hierarchy fields
  const processedData = processDateFields(data, [...rowFields, ...columnFields]);
  
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

// Process data to handle date hierarchy fields
function processDateFields(data, fields) {
  if (!fields || fields.length === 0) return data;
  
  return data.map(row => {
    const newRow = { ...row };
    
    fields.forEach(field => {
      if (field.includes('|')) {
        const [baseField, datePart] = field.split('|');
        if (row[baseField] !== undefined) {
          newRow[field] = getDatePartValue(row[baseField], datePart);
        }
      }
    });
    
    return newRow;
  });
}

// Get unique combinations of values for the given fields
function getUniqueValues(data, fields) {
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

// Calculate row grand totals
function calculateRowGrandTotals(pivotData, columnHeaders, valueFields, aggregateFunctions) {
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
function calculateColumnGrandTotals(data, columnHeaders, rowFields, columnFields, valueFields, aggregateFunctions) {
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

const CustomPivotTableUI = ({ data }) => {
  const [rowFields, setRowFields] = useState([]);
  const [columnFields, setColumnFields] = useState([]);
  const [valueFields, setValueFields] = useState([]);
  const [selectedAggregates, setSelectedAggregates] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [columnHeaders, setColumnHeaders] = useState([]);
  const [columnGrandTotals, setColumnGrandTotals] = useState(null);
  const [fieldTypes, setFieldTypes] = useState({});
  const [availableFields, setAvailableFields] = useState([]);

  // Aggregate options
  const aggregateOptions = [
    { label: "Sum", value: "sum" },
    { label: "Count", value: "count" },
    { label: "Average", value: "avg" },
    { label: "Min", value: "min" },
    { label: "Max", value: "max" },
  ];

  // Initialize field types and available fields
  useEffect(() => {
    if (data && data.length > 0) {
      // Pre-process data to convert Excel date numbers if needed
      const processedData = data.map(row => {
        const processedRow = { ...row };
        Object.entries(row).forEach(([key, value]) => {
          if (isExcelDateNumber(value)) {
            // Mark this field for date processing
            processedRow[`__processed_${key}`] = true;
          }
        });
        return processedRow;
      });
      
      const types = detectFieldTypes(processedData);
      setFieldTypes(types);
      
      // Create base field options
      const baseFields = Object.keys(data[0]).map(key => ({ 
        label: key, 
        value: key,
        type: types[key]
      }));
      
      // Add date hierarchy fields
      const dateFields = Object.entries(types)
        .filter(([_, type]) => type === 'date')
        .map(([field]) => field);
      
      const dateHierarchyFields = generateDateHierarchyFields(dateFields);
      
      setAvailableFields([...baseFields, ...dateHierarchyFields]);
    }
  }, [data]);

  const handleRowFieldsChange = (selectedOptions) => {
    setRowFields(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleColumnFieldsChange = (selectedOptions) => {
    setColumnFields(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleValueFieldsChange = (selectedOptions) => {
    setValueFields(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleAggregateChange = (selectedOptions) => {
    setSelectedAggregates(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleGeneratePivot = () => {
    if (!valueFields.length || !selectedAggregates.length) {
      alert(
        "Please select at least one value field and one aggregate function."
      );
      return;
    }

    if (!rowFields.length && !columnFields.length) {
      alert("Please select at least one row or column field.");
      return;
    }

    const result = generatePivotData(
      data,
      rowFields,
      columnFields,
      valueFields,
      selectedAggregates
    );
    
    setPivotData(result.pivotData);
    setColumnHeaders(result.columnHeaders);
    setColumnGrandTotals(result.columnGrandTotals);
  };

  const renderTableHeader = () => {
    if (!columnHeaders.length || !pivotData.length) return null;

    const rowHeaderCount = rowFields.length;
    const valueAggregateCombos = [];
    valueFields.forEach((valueField) => {
      selectedAggregates.forEach((aggregate) => {
        valueAggregateCombos.push({ valueField, aggregate });
      });
    });

    const hasMultipleValueAggregates = valueAggregateCombos.length > 1;

    return (
      <thead>
        <tr>
          {/* Row field headers */}
          {rowHeaderCount > 0 && (
            <th
              colSpan={rowHeaderCount}
              rowSpan={hasMultipleValueAggregates ? 2 : 1}
              className="bg-gray-100 font-bold"
            ></th>
          )}
          
          {/* Column field headers */}
          {columnHeaders.map((header, idx) => {
            // Format date values in column headers if they are dates
            const formattedValues = header.values.map((value, i) => {
              const fieldName = columnFields[i];
              if (fieldName && fieldTypes[fieldName] === 'date') {
                return formatDateValue(value);
              }
              return value;
            });
            
            return (
              <th
                key={`col-header-${idx}`}
                colSpan={valueAggregateCombos.length}
                className="bg-blue-500 text-white font-bold text-center whitespace-nowrap p-2"
              >
                {formattedValues.join(" - ")}
              </th>
            );
          })}
          
          {/* Grand Total column header */}
          <th
            colSpan={valueAggregateCombos.length}
            rowSpan={hasMultipleValueAggregates ? 1 : undefined}
            className="bg-gray-700 text-white font-bold text-center whitespace-nowrap p-2"
          >
            Grand Total
          </th>
        </tr>
        
        {/* Value field and aggregate function headers if multiple combinations */}
        {hasMultipleValueAggregates && (
          <tr>
            {/* Value-aggregate headers for each column */}
            {columnHeaders.map((colHeader) =>
              valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
                <th
                  key={`${colHeader.key}-${valueField}-${aggregate}-${idx}`}
                  className="bg-gray-200 text-center p-2"
                >
                  {`${valueField} (${aggregate})`}
                </th>
              ))
            )}
            
            {/* Value-aggregate headers for Grand Total column */}
            {valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
              <th
                key={`grand-total-${valueField}-${aggregate}-${idx}`}
                className="bg-gray-500 text-white text-center p-2"
              >
                {`${valueField} (${aggregate})`}
              </th>
            ))}
          </tr>
        )}
        
        {/* Field labels row */}
        <tr>
          {/* Row field labels */}
          {rowFields.map((field, idx) => {
            // Extract base field name if it's a date hierarchy field
            const displayField = field.includes('|') 
              ? `${field.split('|')[0]} (${field.split('|')[1]})` 
              : field;
              
            return (
              <th
                key={`row-field-${idx}`}
                className="bg-gray-100 font-bold text-left p-2"
              >
                {displayField}
              </th>
            );
          })}
          
          {/* Value-aggregate labels for each column if not multiple combos */}
          {!hasMultipleValueAggregates && columnHeaders.map((colHeader) =>
            valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
              <th
                key={`header-placeholder-${colHeader.key}-${idx}`}
                className="bg-gray-200 text-center p-2"
              >
                {`${valueField} (${aggregate})`}
              </th>
            ))
          )}
          
          {/* Value-aggregate labels for Grand Total if not multiple combos */}
          {!hasMultipleValueAggregates && valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
            <th
              key={`grand-total-label-${valueField}-${aggregate}-${idx}`}
              className="bg-gray-500 text-white text-center p-2"
            >
              {`${valueField} (${aggregate})`}
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  const renderTableBody = () => {
    if (!pivotData.length) return null;

    const valueAggregateCombos = [];
    valueFields.forEach((valueField) => {
      selectedAggregates.forEach((aggregate) => {
        valueAggregateCombos.push({ valueField, aggregate });
      });
    });

    return (
      <tbody>
        {/* Regular data rows */}
        {pivotData.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="hover:bg-gray-100">
            {/* Row values */}
            {row.rowValues.map((value, idx) => {
              // Get the field name and check if it's a date field
              const fieldName = rowFields[idx];
              const isDateField = fieldTypes[fieldName] === 'date' || 
                                 (fieldName && fieldName.includes('|') && fieldName.split('|')[1] === 'date');
              
              // Format date if needed
              let displayValue = value;
              if (isDateField && value) {
                displayValue = formatDateValue(value);
              }
              
              return (
                <td
                  key={`row-value-${idx}`}
                  className="bg-gray-50 font-medium text-left p-2 border border-gray-200"
                >
                  {displayValue !== null && displayValue !== undefined ? displayValue : '-'}
                </td>
              );
            })}
            
            {/* Cell values for each column */}
            {columnHeaders.map((column) =>
              valueAggregateCombos.map(({ valueField, aggregate }) => {
                const cellKey = `${column.key}|${valueField}|${aggregate}`;
                const value = row.cells[cellKey];
                return (
                  <td
                    key={cellKey}
                    className="text-right p-2 border border-gray-200"
                  >
                    {formatCellValue(value, aggregate)}
                  </td>
                );
              })
            )}
            
            {/* Row Grand Total values */}
            {valueAggregateCombos.map(({ valueField, aggregate }) => {
              const cellKey = `grandTotal|${valueField}|${aggregate}`;
              const value = row.cells[cellKey];
              return (
                <td
                  key={cellKey}
                  className="text-right p-2 border border-gray-200 bg-gray-100 font-medium"
                >
                  {formatCellValue(value, aggregate)}
                </td>
              );
            })}
          </tr>
        ))}
        
        {/* Grand Total row */}
        {columnGrandTotals && (
          <tr className="bg-gray-200 font-bold hover:bg-gray-300">
            {/* "Grand Total" label */}
            <td
              colSpan={rowFields.length}
              className="text-left p-2 border border-gray-300 bg-gray-300"
            >
              Grand Total
            </td>
            
            {/* Column grand total values */}
            {columnHeaders.map((column) =>
              valueAggregateCombos.map(({ valueField, aggregate }) => {
                const cellKey = `${column.key}|${valueField}|${aggregate}`;
                const value = columnGrandTotals.cells[cellKey];
                return (
                  <td
                    key={cellKey}
                    className="text-right p-2 border border-gray-300 bg-gray-200"
                  >
                    {formatCellValue(value, aggregate)}
                  </td>
                );
              })
            )}
            
            {/* Overall grand total values */}
            {valueAggregateCombos.map(({ valueField, aggregate }) => {
              const cellKey = `grandTotal|${valueField}|${aggregate}`;
              const value = columnGrandTotals.cells[cellKey];
              return (
                <td
                  key={cellKey}
                  className="text-right p-2 border border-gray-300 bg-gray-400 text-white font-bold"
                >
                  {formatCellValue(value, aggregate)}
                </td>
              );
            })}
          </tr>
        )}
      </tbody>
    );
  };

  // Format cell values based on the aggregate function
  const formatCellValue = (value, aggregateFunc) => {
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

  const selectStyles = {
    control: (provided) => ({
      ...provided,
      borderColor: "#e2e8f0",
      boxShadow: "none",
      "&:hover": {
        borderColor: "#cbd5e0",
      },
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: "0.375rem",
      boxShadow:
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? "#3b82f6" 
        : state.isFocused 
          ? "#dbeafe" 
          : undefined,
      color: state.isSelected ? "white" : undefined,
    }),
  };

  // Group options by type for better organization
  const groupedOptions = [
    {
      label: "Standard Fields",
      options: availableFields.filter(field => !field.value.includes('|'))
    },
    {
      label: "Date Hierarchy Fields",
      options: availableFields.filter(field => field.value.includes('|'))
    }
  ];

  return (
    <div className="font-sans rounded-lg bg-gray-50 shadow-md">
      <h3 className="text-xl p-5 border-b border-gray-200 text-gray-700">
        Enhanced Custom Pivot Table
      </h3>
      <div className="p-5 bg-white rounded-b-lg">
        <h4 className="text-lg mb-4 text-gray-600 font-medium">
          Configure Pivot Table
        </h4>

        <div className="mb-4">
          <h5 className="text-sm mb-2 text-gray-600 font-medium">Row Fields</h5>
          <Select
            isMulti
            options={groupedOptions}
            onChange={handleRowFieldsChange}
            placeholder="Select row fields..."
            className="mb-2"
            classNamePrefix="react-select"
            styles={selectStyles}
          />
        </div>

        <div className="mb-4">
          <h5 className="text-sm mb-2 text-gray-600 font-medium">
            Column Fields
          </h5>
          <Select
            isMulti
            options={groupedOptions}
            onChange={handleColumnFieldsChange}
            placeholder="Select column fields..."
            className="mb-2"
            classNamePrefix="react-select"
            styles={selectStyles}
          />
        </div>

        <div className="mb-4">
          <h5 className="text-sm mb-2 text-gray-600 font-medium">
            Value Fields
          </h5>
          <Select
            isMulti
            options={availableFields.filter(field => 
              !field.value.includes('|') && fieldTypes[field.value] === 'number'
            )}
            onChange={handleValueFieldsChange}
            placeholder="Select value fields..."
            className="mb-2"
            classNamePrefix="react-select"
            styles={selectStyles}
          />
        </div>

        <div className="mb-4">
          <h5 className="text-sm mb-2 text-gray-600 font-medium">Aggregates</h5>
          <Select
            isMulti
            options={aggregateOptions}
            onChange={handleAggregateChange}
            placeholder="Select aggregates..."
            className="mb-2"
            classNamePrefix="react-select"
            styles={selectStyles}
          />
        </div>

        <button
          onClick={handleGeneratePivot}
          disabled={
            !valueFields.length ||
            !selectedAggregates.length ||
            (!rowFields.length && !columnFields.length)
          }
          className={`py-2 px-4 rounded text-white font-medium transition-colors duration-200 ${
            !valueFields.length ||
            !selectedAggregates.length ||
            (!rowFields.length && !columnFields.length)
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          }`}
        >
          Generate Pivot Table
        </button>
      </div>

      {pivotData.length > 0 && (
        <div className="p-5 mt-6 bg-white rounded-lg shadow">
          <h4 className="text-lg mb-4 text-gray-600 font-medium">
            Pivot Table Results
          </h4>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full border-collapse">
              {renderTableHeader()}
              {renderTableBody()}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomPivotTableUI;