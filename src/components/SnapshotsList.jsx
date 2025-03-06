import React, { useState } from 'react';
import { AlertCircle, Download, RefreshCw, Calendar, Database, DollarSign } from 'lucide-react';

const SnapshotsList = ({ title, snapshots, status, downloadSnapshot, cancelSnapshot, downloading, canceling, getStatusColor }) => {
    // Move useState to the top, before any conditionals
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // If no snapshots, return null after hooks declaration
    if (!snapshots.length) return null;

    const totalPages = Math.ceil(snapshots.length / ITEMS_PER_PAGE);

    const displayedSnapshots = snapshots.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const goToPage = (page) => {
        setCurrentPage(Math.min(Math.max(1, page), totalPages));
    };

    // Generate array of page numbers to show
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            // If 7 or fewer pages, show all
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show pages around current page
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="mt-4">
            <h4 className={`font-medium ${getStatusColor(status)}`}>{title}</h4>
            
            {/* Table Display */}
            <div className="mt-2 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Snapshot ID
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Created Date
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Data Rows
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cost
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedSnapshots.map((snapshot) => (
                            <tr key={snapshot.id}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{snapshot.id}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {snapshot.created ? 
                                            new Date(snapshot.created).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                            }) : 'N/A'
                                        }
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <Database className="h-4 w-4 mr-1" />
                                        {snapshot.dataset_size !== undefined ? 
                                            snapshot.dataset_size.toLocaleString() + " rows" : 
                                            'N/A'
                                        }
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-500">
                                        <DollarSign className="h-4 w-4 mr-1" />
                                        {snapshot.cost > 0 ? `$${snapshot.cost.toFixed(2)}` : 'N/A'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    {status === 'ready' && (
                                        <button
                                            onClick={() => downloadSnapshot(snapshot.id)}
                                            disabled={!!downloading}
                                            className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {downloading === snapshot.id ? (
                                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4 mr-1" />
                                            )}
                                            {downloading === snapshot.id ? 'Downloading...' : 'Download'}
                                        </button>
                                    )}
                                    {status === 'running' && (
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => cancelSnapshot(snapshot.id)}
                                                disabled={!!canceling}
                                                className="inline-flex items-center px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {canceling === snapshot.id ? (
                                                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 mr-1" />
                                                )}
                                                {canceling === snapshot.id ? 'Canceling...' : 'Cancel'}
                                            </button>
                                            <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                    {status === 'failed' && (
                                        <AlertCircle className="h-5 w-5 text-red-500 ml-auto" />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                    <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-sm font-medium text-gray-700 bg-white rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        First
                    </button>

                    {getPageNumbers().map((pageNumber, index) => (
                        pageNumber === '...' ? (
                            <span key={`ellipsis-${index}`} className="text-gray-500">...</span>
                        ) : (
                            <button
                                key={pageNumber}
                                onClick={() => goToPage(pageNumber)}
                                className={`px-3 py-1 text-sm font-medium rounded-md ${
                                    currentPage === pageNumber
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 bg-white hover:bg-gray-50'
                                }`}
                            >
                                {pageNumber}
                            </button>
                        )
                    ))}

                    <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-sm font-medium text-gray-700 bg-white rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Last
                    </button>
                </div>
            )}
        </div>
    );
};

export default SnapshotsList;