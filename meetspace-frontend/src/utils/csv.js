function escapeCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value).replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, columns, rows) {
  const header = columns.map((column) => escapeCell(column.label)).join(";");
  const body = rows.map((row) => columns.map((column) => {
    const value = typeof column.value === "function" ? column.value(row) : row[column.value];
    return escapeCell(value);
  }).join(";"));
  const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
