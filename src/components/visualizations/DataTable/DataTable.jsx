import React, { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'

export default function DataTable({ data, config = {} }) {
  const pageSize = config.pageSize || 10

  const columns = useMemo(() => {
    if (!data || !data.byAgent || !data.byAgent.length) return []
    const keys = Object.keys(data.byAgent[0])
    return keys.map(key => ({
      accessorKey: key,
      header: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      size: config.columnWidths?.[key] || 150,
    }))
  }, [data, config])

  const rows = useMemo(() => {
    if (!data?.byAgent) return []
    const summary = [
      { agent: 'TOTAL', count: data.total || 0, __meta: true },
      { agent: 'AVERAGE', count: Math.round(data.average || 0), __meta: true },
      { agent: 'MAX', count: data.max || 0, __meta: true },
      ...(data.byAgent || []),
    ]
    return summary
  }, [data])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    enableSorting: config.sortable !== false,
  })

  if (!columns.length) {
    return <div className="flex items-center justify-center h-32 text-zinc-400 text-xs">No data</div>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] font-mono border-collapse">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  className={`text-left px-3 py-2 font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 ${
                    config.sortable !== false ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/40' : ''
                  }`}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ width: header.getSize() }}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (
                      <span className="text-[9px]">{header.column.getIsSorted() === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                row.original.__meta ? 'font-semibold bg-zinc-50/50 dark:bg-zinc-800/20' : ''
              } ${i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-zinc-50/30 dark:bg-zinc-900/10'}`}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-700/30 text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-3 py-2 text-[10px] text-zinc-400 dark:text-zinc-500">
        <span>
          Showing {table.getState().pagination.pageIndex * pageSize + 1}–
          {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, rows.length)} of {rows.length}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          >
            Prev
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
