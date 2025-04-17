import React, { useState } from "react";
import Select from "react-select";
import { generatePivotData } from "../utils/CustomPivotTableLogic";


const aggregateOptions = [
  { label: "Sum", value: "sum" },
  { label: "Count", value: "count" },
  { label: "Average", value: "avg" },
  { label: "Min", value: "min" },
  { label: "Max", value: "max" },
];

const CustomPivotTableUI = ({ data }) => {
  const [rowFields, setRowFields] = useState([]);
  const [columnFields, setColumnFields] = useState([]);
  const [valueFields, setValueFields] = useState([]);
  const [selectedAggregates, setSelectedAggregates] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [columnHeaders, setColumnHeaders] = useState([]);

  const availableFields =
    data && data.length > 0
      ? Object.keys(data[0]).map((key) => ({ label: key, value: key }))
      : [];

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
          {rowHeaderCount > 0 && (
            <th
              colSpan={rowHeaderCount}
              rowSpan={hasMultipleValueAggregates ? 2 : 1}
              className="bg-gray-100 font-bold"
            ></th>
          )}
          {columnHeaders.map((header, idx) => (
            <th
              key={`col-header-${idx}`}
              colSpan={valueAggregateCombos.length}
              className="bg-blue-500 text-white font-bold text-center whitespace-nowrap p-2"
            >
              {header.values.join(" - ")}
            </th>
          ))}
        </tr>
        {hasMultipleValueAggregates && (
          <tr>
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
          </tr>
        )}
        <tr>
          {rowFields.map((field, idx) => (
            <th
              key={`row-field-${idx}`}
              className="bg-gray-100 font-bold text-left p-2"
            >
              {field}
            </th>
          ))}
          {columnHeaders.map((colHeader) =>
            valueAggregateCombos.map(({ valueField, aggregate }, idx) => (
              <th
                key={`header-placeholder-${colHeader.key}-${idx}`}
                className="bg-gray-200 text-center p-2"
              >
                {!hasMultipleValueAggregates
                  ? `${valueField} (${aggregate})`
                  : ""}
              </th>
            ))
          )}
        </tr>
      </thead>
    );
  };

  const renderTableBody = () => {
    if (!pivotData.length) return null;

    return (
      <tbody>
        {pivotData.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="hover:bg-gray-100">
            {row.rowValues.map((value, idx) => (
              <td
                key={`row-value-${idx}`}
                className="bg-gray-50 font-bold text-left p-2 border border-gray-200"
              >
                {value}
              </td>
            ))}
            {columnHeaders.map((column) =>
              valueFields.map((valueField) =>
                selectedAggregates.map((aggregate) => {
                  const cellKey = `${column.key}|${valueField}|${aggregate}`;
                  const value = row.cells[cellKey];
                  return (
                    <td
                      key={cellKey}
                      className="text-right p-2 border border-gray-200"
                    >
                      {value !== null && value !== undefined
                        ? typeof value === "number" && !isNaN(value)
                          ? value.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })
                          : value
                        : "-"}
                    </td>
                  );
                })
              )
            )}
          </tr>
        ))}
      </tbody>
    );
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
  };

  return (
    <div className="font-sans rounded-lg bg-gray-50 shadow-md">
      <h3 className="text-xl p-5 border-b border-gray-200 text-gray-700">
        Custom Pivot Table
      </h3>
      <div className="p-5 bg-white rounded-b-lg">
        <h4 className="text-lg mb-4 text-gray-600 font-medium">
          Configure Pivot Table
        </h4>

        <div className="mb-4">
          <h5 className="text-sm mb-2 text-gray-600 font-medium">Row Fields</h5>
          <Select
            isMulti
            options={availableFields}
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
            options={availableFields}
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
            options={availableFields}
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
