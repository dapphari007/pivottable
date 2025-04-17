import React, { useState } from "react";
import * as XLSX from "xlsx";
import TableView from "./components/tableview.jsx";
import CustomPivotTableUI from "./components/CustomPivotTableUI";

function App() {
  const [excelFile, setExcelFile] = useState(null);
  const [typeError, setTypeError] = useState(null);
  const [excelData, setExcelData] = useState(null);

  const handleFile = (e) => {
    const fileTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (fileTypes.includes(selectedFile.type)) {
        setTypeError(null);
        const reader = new FileReader();
        reader.readAsArrayBuffer(selectedFile);
        reader.onload = (e) => {
          setExcelFile(e.target.result);
        };
      } else {
        setTypeError("Please select only Excel file types");
        setExcelFile(null);
      }
    } else {
      console.log("Please select your file");
    }
  };

  const handleFileSubmit = (e) => {
    e.preventDefault();
    if (excelFile !== null) {
      const workbook = XLSX.read(excelFile, { type: "buffer" });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      setExcelData(data);
    }
  };

  return (
    <div className="flex flex-col m-5 p-5 border border-gray-200 rounded-lg bg-white shadow-md max-w-6xl mx-auto">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-5 text-gray-700">
          Pivot Table Generator and View Port
        </h3>
        <form
          className="flex flex-wrap gap-3 items-center justify-center mb-5"
          onSubmit={handleFileSubmit}
        >
          <input
            type="file"
            className="py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-md"
            onChange={handleFile}
          />
          <button
            type="submit"
            className="py-2 px-4 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Upload
          </button>
          {typeError && (
            <div className="w-full text-red-500 text-sm mt-2">{typeError}</div>
          )}
        </form>
      </div>

      {excelData ? (
        <>
          <TableView data={excelData} />
          <div className="mt-8">
            <CustomPivotTableUI data={excelData} />
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 mt-4">No data to display</p>
      )}
    </div>
  );
}

export default App;
