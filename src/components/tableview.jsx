import React from "react";

function TableView({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }
  
  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold mb-3 text-gray-700">Data Preview</h4>
      <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Object.keys(data[0]).map((key) => (
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
                {Object.values(row).map((val, i) => (
                  <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {val !== null && val !== undefined ? val.toString() : ''}
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