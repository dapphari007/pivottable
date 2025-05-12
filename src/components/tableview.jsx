import React from "react";

function TableView({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }
  
  // Define which column names might contain dates
  const dateColumnNames = ['date', 'created', 'modified', 'timestamp', 'time'];
  
  // Function to check if a column name suggests it contains dates
  const isDateColumn = (columnName) => {
    return dateColumnNames.some(name => 
      columnName.toLowerCase().includes(name)
    );
  };
  
  // Function to convert Excel date to JavaScript Date
  const excelDateToJSDate = (excelDate) => {
    // Excel dates start from 1900-01-01
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    
    // Format the date without time
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    return date.toLocaleDateString(undefined, options);
  };
  
  // Function to format cell values based on column type
  const formatCellValue = (value, columnName) => {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Only apply date formatting to columns that likely contain dates
    if (isDateColumn(columnName) && typeof value === 'number') {
      return excelDateToJSDate(value);
    }
    
    return value.toString();
  };
  
  const columnNames = Object.keys(data[0]);
  
  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold mb-3 text-gray-700">Data Preview</h4>
      <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columnNames.map((key) => (
                <th 
                  key={key} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columnNames.map((key, i) => (
                  <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCellValue(row[key], key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TableView;