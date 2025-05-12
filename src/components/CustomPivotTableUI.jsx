import React, { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  detectFieldTypes,
  generateDateHierarchyFields,
  generatePivotData,
  formatDateValue,
  isExcelDateNumber,
  formatCellValue,
} from "../utils/pivotLogic";

const InteractivePivotTable = ({ data }) => {
  const [rowFields, setRowFields] = useState([]);
  const [columnFields, setColumnFields] = useState([]);
  const [valueFields, setValueFields] = useState([]);
  const [fieldTypes, setFieldTypes] = useState({});
  const [availableFields, setAvailableFields] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [columnHeaders, setColumnHeaders] = useState([]);
  const [columnGrandTotals, setColumnGrandTotals] = useState(null);
  const [valueFieldAggregates, setValueFieldAggregates] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [rowSortState, setRowSortState] = useState(null);
  const [columnSortState, setColumnSortState] = useState(null);

  // Standard aggregate options
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
      const processedData = data.map((row) => {
        const processedRow = { ...row };
        Object.entries(row).forEach(([key, value]) => {
          if (isExcelDateNumber(value)) {
            processedRow[`__processed_${key}`] = true;
          }
        });
        return processedRow;
      });

      const types = detectFieldTypes(processedData);
      setFieldTypes(types);

      // Create base field options
      const baseFields = Object.keys(data[0]).map((key) => ({
        id: key,
        label: key,
        value: key,
        type: types[key],
      }));

      // Add date hierarchy fields
      const dateFields = Object.entries(types)
        .filter(([_, type]) => type === "date")
        .map(([field]) => field);

      const dateHierarchyFields = generateDateHierarchyFields(dateFields).map(
        (field) => ({
          ...field,
          id: field.value,
        })
      );

      setAvailableFields([...baseFields, ...dateHierarchyFields]);
    }
  }, [data]);

  // Generate pivot table whenever configurations change
  const generatePivotTable = useCallback(() => {
    if (!data || data.length === 0) return;
    if (!valueFields.length) return;

    // Get selected aggregates for each value field
    const selectedAggregates = valueFields.map(
      (field) => valueFieldAggregates[field.value] || "sum"
    );

    // Extract field values for the pivot logic
    const rowFieldValues = rowFields.map((field) => field.value);
    const columnFieldValues = columnFields.map((field) => field.value);
    const valueFieldValues = valueFields.map((field) => field.value);

    const result = generatePivotData(
      data,
      rowFieldValues,
      columnFieldValues,
      valueFieldValues,
      selectedAggregates
    );

    setPivotData(result.pivotData);
    setColumnHeaders(result.columnHeaders);
    setColumnGrandTotals(result.columnGrandTotals);
  }, [data, rowFields, columnFields, valueFields, valueFieldAggregates]);

  // Update pivot table whenever the configuration changes
  useEffect(() => {
    generatePivotTable();
  }, [generatePivotTable]);

  // Updated Sort function
  const requestSort = (key) => {
    // Simple cell sorting
    if (!key.startsWith("header-")) {
      let direction = "asc";
      if (sortConfig.key === key && sortConfig.direction === "asc") {
        direction = "desc";
      }
      setSortConfig({ key, direction });
      return;
    }

    // Handle header sorting
    if (key === "header-row") {
      // Cycle through: null -> asc -> desc -> null
      let newState = null;
      if (rowSortState === null) newState = "asc";
      else if (rowSortState === "asc") newState = "desc";
      else newState = null;

      setRowSortState(newState);

      if (newState === null) {
        // Reset to default order
        setSortConfig({ key: "", direction: "asc" });
        generatePivotTable();
      } else {
        // Set sorting for the first row field
        if (rowFields.length > 0) {
          setSortConfig({
            key: `row-0`,
            direction: newState,
          });
        }
      }
    } else if (key === "header-column") {
      // Cycle through: null -> asc -> desc -> null
      let newState = null;
      if (columnSortState === null) newState = "asc";
      else if (columnSortState === "asc") newState = "desc";
      else newState = null;

      setColumnSortState(newState);

      if (newState === null) {
        // Reset to default order
        setSortConfig({ key: "", direction: "asc" });
        generatePivotTable();
      } else if (columnFields.length > 0 && columnHeaders.length > 0) {
        // Sort column headers
        const sortedHeaders = [...columnHeaders].sort((a, b) => {
          // Compare the first value in each header
          const aValue = a.values[0] || "";
          const bValue = b.values[0] || "";

          if (aValue < bValue) {
            return newState === "asc" ? -1 : 1;
          }
          if (aValue > bValue) {
            return newState === "asc" ? 1 : -1;
          }
          return 0;
        });

        setColumnHeaders(sortedHeaders);
        setSortConfig({ key: "columnHeaderSort", direction: newState });
      }
    }
  };

  // Function to get sort indicator for headers
  const getHeaderSortIndicator = (headerType) => {
    const state = headerType === "row" ? rowSortState : columnSortState;

    if (state === null) {
      return <span className="text-gray-300 ml-1">↕</span>;
    } else if (state === "asc") {
      return <span className="text-blue-500 ml-1">↑</span>;
    } else {
      return <span className="text-blue-500 ml-1">↓</span>;
    }
  };

  // Simplified function to get sort indicator for cells
  const getCellSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="text-blue-500 ml-1">↑</span>
    ) : (
      <span className="text-blue-500 ml-1">↓</span>
    );
  };

  // Apply sorting to pivot data
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key || !pivotData.length) return pivotData;
    if (sortConfig.key === "columnHeaderSort") return pivotData; // Column headers already sorted

    return [...pivotData].sort((a, b) => {
      // Handle row values sorting (by column index)
      if (sortConfig.key.startsWith("row-")) {
        const index = parseInt(sortConfig.key.split("-")[1]);
        if (a.rowValues[index] < b.rowValues[index]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a.rowValues[index] > b.rowValues[index]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      }

      // Handle cell values sorting
      const aValue = a.cells[sortConfig.key] || 0;
      const bValue = b.cells[sortConfig.key] || 0;

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [pivotData, sortConfig]);

  // Reset function to clear all selections
  const handleReset = () => {
    setRowFields([]);
    setColumnFields([]);
    setValueFields([]);
    setValueFieldAggregates({});
    setPivotData([]);
    setColumnHeaders([]);
    setColumnGrandTotals(null);
    setSortConfig({ key: "", direction: "asc" });
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result) => {
    const { source, destination } = result;

    // If dropped outside of a droppable area
    if (!destination) return;

    // Get the source and destination lists
    const sourceId = source.droppableId;
    const destId = destination.droppableId;

    // Don't do anything if dropped in the same position
    if (sourceId === destId && source.index === destination.index) return;

    // Clone all lists to avoid direct state mutation
    const newRowFields = [...rowFields];
    const newColumnFields = [...columnFields];
    const newValueFields = [...valueFields];

    // Get source item
    let sourceItem;

    if (sourceId === "row-fields") {
      sourceItem = rowFields[source.index];
      newRowFields.splice(source.index, 1);
    } else if (sourceId === "column-fields") {
      sourceItem = columnFields[source.index];
      newColumnFields.splice(source.index, 1);
    } else if (sourceId === "value-fields") {
      sourceItem = valueFields[source.index];
      newValueFields.splice(source.index, 1);
    } else if (sourceId === "available-fields") {
      // Find the actual item in available fields (accounting for filtered view)
      const filteredAvailableFields = getFilteredAvailableFields();
      sourceItem = filteredAvailableFields[source.index];
    }

    // Add to destination
    if (destId === "row-fields") {
      newRowFields.splice(destination.index, 0, sourceItem);
    } else if (destId === "column-fields") {
      newColumnFields.splice(destination.index, 0, sourceItem);
    } else if (destId === "value-fields") {
      newValueFields.splice(destination.index, 0, sourceItem);

      // Set default aggregate for value field if it's coming from available fields
      if (sourceId === "available-fields") {
        setValueFieldAggregates((prev) => ({
          ...prev,
          [sourceItem.value]: "sum",
        }));
      }
    } else if (destId === "available-fields") {
      // If we're moving back to available fields, we don't need to add it
      // to available fields since it's already there
    }

    // Update all state
    setRowFields(newRowFields);
    setColumnFields(newColumnFields);
    setValueFields(newValueFields);
  };

  // Handle changing aggregate function for a value field
  const handleAggregateChange = (fieldValue, aggregate) => {
    setValueFieldAggregates((prev) => ({
      ...prev,
      [fieldValue]: aggregate,
    }));
  };

  // Get filtered available fields that aren't used in other sections
  const getFilteredAvailableFields = () => {
    return availableFields.filter(
      (field) =>
        !rowFields.some((f) => f.id === field.id) &&
        !columnFields.some((f) => f.id === field.id) &&
        !valueFields.some((f) => f.id === field.id)
    );
  };

  const renderTableHeader = () => {
    if (!columnHeaders.length || !pivotData.length) return null;

    const rowHeaderCount = rowFields.length;
    const valueAggregateCombos = [];

    valueFields.forEach((valueField) => {
      const aggregate = valueFieldAggregates[valueField.value] || "sum";
      valueAggregateCombos.push({
        valueField: valueField.value,
        aggregate,
      });
    });

    return (
      <thead>
        {/* Column fields identification row */}
        <tr className="border-b border-gray-300">
          {/* Empty space above row headers - only if we have row fields */}
          {rowHeaderCount > 0 && (
            <th
              colSpan={rowHeaderCount}
              className="bg-gray-100 p-2 border border-gray-300"
            ></th>
          )}

          {/* Display column field names */}
          <th
            colSpan={
              columnHeaders.length * valueAggregateCombos.length +
              valueAggregateCombos.length
            }
            className="bg-gray-600 text-white font-bold text-center p-2 border border-gray-300 cursor-pointer hover:bg-gray-700"
            onClick={() => requestSort("header-column")}
          >
            {columnFields.map((field) => field.label).join(" - ")}
            {getHeaderSortIndicator("column")}
          </th>
        </tr>

        {/* First row: Column field headers */}
        <tr className="border-b-2 border-gray-300">
          {/* Row headers space - only if we have row fields */}
          {rowHeaderCount > 0 && (
            <th
              colSpan={rowHeaderCount}
              rowSpan={2}
              className="bg-gray-100 font-bold p-2 border border-gray-300 text-left cursor-pointer hover:bg-gray-200"
              onClick={() => requestSort("header-row")}
            >
              {rowFields.map((field) => field.label).join(" / ")}
              {getHeaderSortIndicator("row")}
            </th>
          )}

          {/* Column field headers */}
          {columnHeaders.map((header, idx) => {
            // Format date values in column headers if they are dates
            const formattedValues = header.values.map((value, i) => {
              const fieldName = columnFields[i]?.value;
              if (fieldName && fieldTypes[fieldName] === "date") {
                return formatDateValue(value);
              }
              return value;
            });

            return (
              <th
                key={`col-header-${idx}`}
                colSpan={valueAggregateCombos.length}
                className="bg-blue-500 text-white font-bold text-center whitespace-nowrap p-2 border border-gray-300"
              >
                {formattedValues.join(" - ")}
              </th>
            );
          })}

          {/* Grand Total column header */}
          <th
            colSpan={valueAggregateCombos.length}
            className="bg-gray-700 text-white font-bold text-center whitespace-nowrap p-2 border border-gray-300"
          >
            Grand Total
          </th>
        </tr>

        {/* Second row: Value fields and aggregation functions */}
        <tr className="border-b-2 border-gray-300">
          {/* Value-aggregate labels for each column */}
          {columnHeaders.map((colHeader) =>
            valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
              <th
                key={`${colHeader.key}-${valueField}-${aggregate}-${idx}`}
                className="bg-gray-200 text-center p-2 border border-gray-300 cursor-pointer hover:bg-gray-300"
                onClick={() =>
                  requestSort(`${colHeader.key}|${valueField}|${aggregate}`)
                }
              >
                {`${valueField} (${aggregate})`}
                {getCellSortIndicator(
                  `${colHeader.key}|${valueField}|${aggregate}`
                )}
              </th>
            ))
          )}

          {/* Value-aggregate labels for Grand Total */}
          {valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
            <th
              key={`grand-total-${valueField}-${aggregate}-${idx}`}
              className="bg-gray-500 text-white text-center p-2 border border-gray-300 cursor-pointer hover:bg-gray-600"
              onClick={() =>
                requestSort(`grandTotal|${valueField}|${aggregate}`)
              }
            >
              {`${valueField} (${aggregate})`}
              {getCellSortIndicator(`grandTotal|${valueField}|${aggregate}`)}
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
      const aggregate = valueFieldAggregates[valueField.value] || "sum";
      valueAggregateCombos.push({
        valueField: valueField.value,
        aggregate,
      });
    });

    return (
      <tbody>
        {/* Regular data rows */}
        {sortedData.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="hover:bg-gray-100">
            {/* Row values - only if we have row fields */}
            {rowFields.length > 0 &&
              row.rowValues.map((value, idx) => {
                // Get the field name and check if it's a date field
                const fieldName = rowFields[idx]?.value;
                const isDateField =
                  fieldTypes[fieldName] === "date" ||
                  (fieldName &&
                    fieldName.includes("|") &&
                    fieldName.split("|")[1] === "date");

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
                    {displayValue !== null && displayValue !== undefined
                      ? displayValue
                      : "-"}
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
            {/* "Grand Total" label - only if we have row fields */}
            {rowFields.length > 0 ? (
              <td
                colSpan={rowFields.length}
                className="text-left p-2 border border-gray-300 bg-gray-300"
              >
                Grand Total
              </td>
            ) : null}

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

  // Field section component with drag and drop capability
  const FieldSection = ({
    title,
    droppableId,
    items,
    emptyMessage,
    bgColor = "bg-gray-50",
    renderItem,
  }) => {
    // Determine if this is the available fields section
    const isAvailableFields = droppableId === "available-fields";
    
    return (
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
        <h4 className="font-medium text-gray-700 mb-2 pb-1 border-b border-gray-200">
          {title}
        </h4>
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-16 ${
                snapshot.isDraggingOver ? "bg-blue-50" : bgColor
              } rounded p-2 transition-colors duration-200 ${
                isAvailableFields ? "max-h-[30rem] overflow-y-auto" : ""
              }`}
            >
              {items.length > 0 ? (
                items.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) =>
                      renderItem(item, provided, snapshot, index)
                    }
                  </Draggable>
                ))
              ) : (
                <div className="text-blue-500 py-2">{emptyMessage}</div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  return (
    <div className="font-sans rounded-lg bg-gray-50 shadow-md">
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-4 rounded-t-lg">
        <h3 className="text-xl font-bold text-white">
          Interactive Pivot Table
        </h3>
      </div>
      <div className="flex flex-col md:flex-row">
        {/* Left side: Pivot Table */}
        <div className="md:w-2/3 p-4">
          {valueFields.length > 0 &&
            (pivotData.length > 0 ? (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full border-collapse border border-gray-300">
                  {renderTableHeader()}
                  {renderTableBody()}
                </table>
              </div>
            ) : (
              <div className="text-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm">
                <p className="text-gray-500">
                  Configure your pivot table using the fields on the right.
                </p>
              </div>
            ))}
          {valueFields.length === 0 && (
            <div className="text-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm">
              <p className="text-gray-500">
                Drag at least one value field to generate the pivot table.
              </p>
            </div>
          )}
        </div>

        {/* Right side: Field Configuration */}
        <div className="md:w-1/3 p-4 border-l border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-700">
              Configure Pivot Table
            </h3>
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Reset Table
            </button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left side: Available Fields Section */}
              <div className="md:w-1/2">
                <FieldSection
                  title="Available Fields"
                  droppableId="available-fields"
                  items={getFilteredAvailableFields()}
                  emptyMessage="All fields are in use"
                  bgColor="bg-gray-50"
                  renderItem={(field, provided, snapshot, index) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center justify-between ${
                        snapshot.isDragging ? "bg-blue-100" : "bg-white"
                      } p-2 mb-1 rounded border ${
                        snapshot.isDragging
                          ? "border-blue-300"
                          : "border-gray-200"
                      } shadow-sm`}
                    >
                      <span>{field.label}</span>
                    </div>
                  )}
                />
              </div>

              {/* Right side: Field Placement Sections */}
              <div className="md:w-1/2 flex flex-col gap-4">
                {/* Row Fields Section */}
                <FieldSection
                  title="Row Fields"
                  droppableId="row-fields"
                  items={rowFields}
                  emptyMessage="Drag fields here"
                  renderItem={(field, provided, snapshot, index) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center justify-between ${
                        snapshot.isDragging ? "bg-blue-100" : "bg-white"
                      } p-2 mb-1 rounded border ${
                        snapshot.isDragging
                          ? "border-blue-300"
                          : "border-gray-200"
                      } shadow-sm`}
                    >
                      <span>{field.label}</span>
                    </div>
                  )}
                />

                {/* Column Fields Section */}
                <FieldSection
                  title="Column Fields"
                  droppableId="column-fields"
                  items={columnFields}
                  emptyMessage="Drag fields here"
                  renderItem={(field, provided, snapshot, index) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center justify-between ${
                        snapshot.isDragging ? "bg-blue-100" : "bg-white"
                      } p-2 mb-1 rounded border ${
                        snapshot.isDragging
                          ? "border-blue-300"
                          : "border-gray-200"
                      } shadow-sm w-full`}
                    >
                      <span className="font-medium">{field.label}</span>

                      {/* Add sort button for column fields */}
                  
                    </div>
                  )}
                />

                {/* Value Fields Section */}
                <FieldSection
                  title="Value Fields"
                  droppableId="value-fields"
                  items={valueFields}
                  emptyMessage="Drag fields here"
                  renderItem={(field, provided, snapshot, index) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex flex-col ${
                        snapshot.isDragging ? "bg-blue-100" : "bg-white"
                      } p-2 mb-1 rounded border ${
                        snapshot.isDragging
                          ? "border-blue-300"
                          : "border-gray-200"
                      } shadow-sm`}
                    >
                      <span className="font-medium">{field.label}</span>
                      <div className="flex items-center mt-1">
                        <select
                          value={valueFieldAggregates[field.value] || "sum"}
                          onChange={(e) =>
                            handleAggregateChange(field.value, e.target.value)
                          }
                          className="w-full px-2 py-1 text-xs border rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {aggregateOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
          </DragDropContext>

          <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-4">
            <p className="text-xs text-gray-600">Tips:</p>
            <ul className="list-disc pl-5 mt-1 text-xs text-gray-600">
              <li>Drag and drop fields to configure your pivot table</li>
              <li>Click on column headers to sort data</li>
              <li>Add at least one value field to generate results</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractivePivotTable;
